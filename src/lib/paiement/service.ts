import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite, alerterEquipe } from "@/lib/email/envoyer";
import { emailAlerte } from "@/lib/email/modeles";
import { consulterPaiement, creerPaiement, ErreurPrestataire } from "./genuka";
import { estTermine, montantAPayer, normaliserTelephone, type DureeAbonnement, type StatutPaiement } from "./regles";

type Resultat = { erreur: string } | { paiementId: string; urlRedirection: string | null };

// Lance un paiement Mobile Money pour un abonnement.
// Vérifie d'abord, au nom de la personne connectée, qu'elle administre bien ce titulaire.
export async function lancerPaiement(
  supabase: SupabaseClient,
  utilisateur: User,
  abonnementId: string,
  duree: DureeAbonnement,
  telephoneSaisi: string,
): Promise<Resultat> {
  const telephone = normaliserTelephone(telephoneSaisi);
  if (!telephone) return { erreur: "Numéro invalide : indiquez-le au format international, par exemple +241 77 12 34 56." };

  const { data: mesAbonnements } = await supabase.rpc("mes_abonnements");
  const abonnement = (mesAbonnements ?? []).find((a: { abonnement_id: string }) => a.abonnement_id === abonnementId) as
    | { abonnement_id: string; titulaire: string; cabinet_id: string | null }
    | undefined;
  if (!abonnement) return { erreur: "Abonnement introuvable." };

  const admin = clientSupabaseAdmin();
  const code = abonnement.cabinet_id ? "pro_cabinet" : "pro_entreprise";
  const { data: formule } = await admin
    .from("formules")
    .select("id, libelle, prix_mensuel, devise, actif")
    .eq("code", code)
    .single();
  if (!formule?.actif || Number(formule.prix_mensuel) <= 0) {
    return { erreur: "Le tarif Pro n'est pas encore disponible. Contactez-nous pour souscrire." };
  }

  const montant = montantAPayer(Number(formule.prix_mensuel), duree);
  const { data: paiement, error } = await admin
    .from("paiements")
    .insert({
      abonnement_id: abonnementId,
      formule_id: formule.id,
      duree_mois: duree,
      montant,
      devise: formule.devise,
      telephone,
      initie_par: utilisateur.id,
    })
    .select("id")
    .single();
  if (error || !paiement) return { erreur: "Le paiement n'a pas pu être préparé." };

  try {
    const cree = await creerPaiement({
      montant,
      devise: formule.devise,
      telephone,
      referenceInterne: paiement.id,
      description: `${formule.libelle} — ${duree === 12 ? "12 mois" : "1 mois"} — ${abonnement.titulaire}`,
      nomClient: String(utilisateur.user_metadata?.nom_complet ?? abonnement.titulaire),
      urlRetour: `${adresseSite()}/espace/abonnement?paiement=${paiement.id}`,
    });
    await admin
      .from("paiements")
      .update({ suivi_prestataire: cree.suivi, reference_prestataire: cree.reference, statut: cree.statut })
      .eq("id", paiement.id);
    return { paiementId: paiement.id, urlRedirection: cree.urlRedirection };
  } catch (erreur) {
    console.error("Création du paiement Genuka impossible :", erreur);
    const details = erreur instanceof ErreurPrestataire ? erreur.details : String(erreur);
    await admin.rpc("appliquer_paiement", { p_paiement_id: paiement.id, p_statut: "echoue", p_erreur: details.slice(0, 300) });
    return {
      erreur:
        erreur instanceof ErreurPrestataire && erreur.statut === 422
          ? "Ce numéro n'est pas accepté pour le paiement Mobile Money. Vérifiez-le et réessayez."
          : "Le service de paiement ne répond pas. Réessayez dans quelques minutes.",
    };
  }
}

// Met à jour un paiement à partir d'un résultat (webhook ou consultation du prestataire).
// Prévient l'équipe quand un paiement vient d'être confirmé.
export async function enregistrerResultat(
  paiementId: string,
  statut: StatutPaiement,
  infos: { reference?: string | null; frais?: number | null; net?: number | null; erreur?: string | null } = {},
): Promise<StatutPaiement | null> {
  const admin = clientSupabaseAdmin();
  const { data: avant } = await admin.from("paiements").select("statut, montant, devise").eq("id", paiementId).maybeSingle();
  if (!avant) return null; // référence inconnue : rien à faire
  const { data: apres, error } = await admin.rpc("appliquer_paiement", {
    p_paiement_id: paiementId,
    p_statut: statut,
    p_reference: infos.reference ?? null,
    p_frais: infos.frais ?? null,
    p_montant_net: infos.net ?? null,
    p_erreur: infos.erreur ?? null,
  });
  if (error) throw error;

  if (avant.statut !== "reussi" && apres === "reussi") {
    await alerterEquipe(
      emailAlerte({
        titre: "Paiement reçu",
        lignes: [
          ["Montant", `${avant.montant} ${avant.devise}`],
          ["Paiement", paiementId],
        ],
      }),
    );
  }
  return apres as StatutPaiement;
}

// Interroge le prestataire (utile quand ses notifications ne peuvent pas nous joindre,
// par exemple en développement local).
export async function synchroniserPaiement(paiementId: string): Promise<StatutPaiement | null> {
  const admin = clientSupabaseAdmin();
  const { data: paiement } = await admin.from("paiements").select("statut, suivi_prestataire").eq("id", paiementId).single();
  if (!paiement) return null;
  if (estTermine(paiement.statut) || !paiement.suivi_prestataire) return paiement.statut;

  const resultat = await consulterPaiement(paiement.suivi_prestataire);
  if (resultat.statut === paiement.statut) return paiement.statut;
  return enregistrerResultat(paiementId, resultat.statut, { reference: resultat.reference, erreur: resultat.erreur });
}
