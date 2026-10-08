"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { lancerPaiement, synchroniserPaiement } from "@/lib/paiement/service";
import type { StatutPaiement } from "@/lib/paiement/regles";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { alerterEquipe } from "@/lib/email/envoyer";
import { emailAlerte } from "@/lib/email/modeles";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaActivationAbonnement, schemaFormule, schemaPaiement } from "@/lib/validation/schemas";

// Paiement Mobile Money : le client valide ensuite la demande sur son téléphone.
export async function payerAbonnement(abonnementId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaPaiement, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const resultat = await lancerPaiement(supabase, utilisateur, abonnementId, lu.donnees.duree, lu.donnees.telephone);
  if ("erreur" in resultat) return { erreur: resultat.erreur, valeurs: lu.valeurs };

  // Certains moyens de paiement passent par une page du prestataire ; sinon on suit le paiement ici.
  redirect(resultat.urlRedirection ?? `/espace/abonnement?paiement=${resultat.paiementId}`);
}

// Vérifie où en est un paiement (appelé régulièrement pendant que le client valide sur son téléphone).
// La lecture passe par le client de la personne : la RLS garantit qu'elle ne voit que ses paiements.
export async function verifierPaiement(paiementId: string): Promise<StatutPaiement | null> {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.from("paiements").select("id").eq("id", paiementId).maybeSingle();
  if (!data) return null;
  try {
    return await synchroniserPaiement(paiementId);
  } catch (erreur) {
    console.error("Vérification du paiement impossible :", erreur);
    return null;
  }
}

// Le client demande à passer à Pro (en attendant le paiement en ligne, l'équipe le contacte).
export async function demanderPassagePro(abonnementId: string, titulaire: string): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const { error } = await supabase.rpc("demander_passage_pro", { p_abonnement_id: abonnementId });
  if (error) return { erreur: "Demande impossible." };

  const { profil } = await droitsUtilisateur();
  await alerterEquipe(
    emailAlerte({
      titre: "Demande de passage à Pro",
      lignes: [
        ["Structure", titulaire],
        ["Contact", profil?.nom_complet || ""],
        ["Email", utilisateur.email ?? ""],
      ],
    }),
  );
  refresh();
  return { succes: "Demande envoyée : notre équipe vous contacte très vite." };
}

// Administrateur plateforme : active ou prolonge un abonnement (après paiement hors ligne).
// La base refuse cette modification à toute autre personne.
export async function activerAbonnement(
  abonnementId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaActivationAbonnement, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data: formule } = await supabase.from("formules").select("est_essai").eq("id", lu.donnees.formule_id).single();
  const { data, error } = await supabase
    .from("abonnements")
    .update({
      formule_id: lu.donnees.formule_id,
      statut: formule?.est_essai ? "essai" : "actif",
      fin: `${lu.donnees.fin}T23:59:59Z`,
    })
    .eq("id", abonnementId)
    .select("id");
  if (error || !data?.length) return { erreur: "Modification refusée.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Abonnement mis à jour." };
}

export async function modifierFormule(formuleId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaFormule, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase.from("formules").update(lu.donnees).eq("id", formuleId).select("id");
  if (error || !data?.length) return { erreur: "Modification refusée.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Formule enregistrée." };
}
