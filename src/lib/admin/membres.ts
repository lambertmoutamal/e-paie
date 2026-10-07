import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nouveauLienActivation, reserverEnvoi, supprimerCompteCree, trouverOuCreerCompte, type Compte } from "./comptes";
import { adresseSite, envoyerEmail } from "@/lib/email/envoyer";
import { emailAccesAjoute, emailInvitation } from "@/lib/email/modeles";
import { libelleRole } from "@/lib/auth/roles";

export type Resultat = { erreur: string } | { message: string };

// Toutes les écritures « métier » passent par le client de la personne connectée
// (supabase) : la RLS s'applique et le journal d'audit enregistre son nom.
// Seule la création du compte utilise la clé secrète, après vérification des droits.

export async function ajouterAdminCabinet(
  supabase: SupabaseClient,
  cabinetId: string,
  email: string,
  nomComplet: string,
): Promise<Resultat> {
  const { data: autorise } = await supabase.rpc("peut_gerer_cabinet", { p_cabinet_id: cabinetId });
  if (autorise !== true) return { erreur: "Vous n'avez pas le droit de gérer ce cabinet." };

  const { data: cabinet } = await supabase.from("cabinets").select("nom").eq("id", cabinetId).single();
  const compte = await trouverOuCreerCompte(email, nomComplet);
  const { error } = await supabase.from("membres_cabinet").insert({ cabinet_id: cabinetId, profil_id: compte.id });
  if (error) {
    await supprimerCompteCree(compte);
    return {
      erreur:
        error.code === "23505"
          ? "Cette personne est déjà administrateur de ce cabinet."
          : "L'administrateur n'a pas pu être ajouté.",
    };
  }
  return { message: await prevenir(compte, email, nomComplet, `Administrateur du cabinet ${cabinet?.nom ?? ""}`) };
}

export async function affecterPersonne(
  supabase: SupabaseClient,
  entrepriseId: string,
  email: string,
  nomComplet: string,
  role: string,
): Promise<Resultat> {
  const { data: autorise } = await supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: entrepriseId });
  if (autorise !== true) return { erreur: "Vous n'avez pas le droit de gérer cette entreprise." };

  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("raison_sociale")
    .eq("id", entrepriseId)
    .single();
  const compte = await trouverOuCreerCompte(email, nomComplet);
  // Si l'affectation existait et avait été retirée, elle est simplement réactivée.
  const { error } = await supabase
    .from("affectations")
    .upsert(
      { entreprise_id: entrepriseId, profil_id: compte.id, role, actif: true },
      { onConflict: "entreprise_id,profil_id,role" },
    );
  if (error) {
    await supprimerCompteCree(compte);
    return { erreur: "La personne n'a pas pu être affectée." };
  }
  const perimetre = `${libelleRole(role)} · ${entreprise?.raison_sociale ?? ""}`;
  return { message: await prevenir(compte, email, nomComplet, perimetre) };
}

// Envoie l'invitation (nouveau compte) ou un simple avis (compte existant).
// L'accès est déjà enregistré : un échec d'envoi n'annule rien, on le signale.
async function prevenir(compte: Compte, email: string, nom: string, perimetre: string): Promise<string> {
  try {
    if (compte.nouveau && compte.lienActivation) {
      await envoyerEmail(email, emailInvitation({ nom, perimetre, lien: compte.lienActivation }));
      return `Invitation envoyée à ${email}. La personne doit cliquer sur le lien reçu (valable 24 h) pour activer son compte et choisir son mot de passe.`;
    }
    await envoyerEmail(email, emailAccesAjoute({ nom, perimetre, lienConnexion: `${adresseSite()}/connexion` }));
    return `${nom} avait déjà un compte : l'accès a été ajouté et un email l'en a informé.`;
  } catch (erreur) {
    console.error("Envoi d'email impossible :", erreur);
    return compte.nouveau
      ? `${nom} a été ajouté(e), mais l'email d'invitation n'a pas pu être envoyé. Utilisez « Renvoyer l'invitation ».`
      : `${nom} a été ajouté(e). (L'email d'information n'a pas pu être envoyé.)`;
  }
}

// Renvoi d'invitation : réservé à qui gère l'entreprise / le cabinet de la personne.
export async function renvoyerInvitation(
  supabase: SupabaseClient,
  profilId: string,
  contexte: { entrepriseId: string } | { cabinetId: string },
): Promise<Resultat> {
  if ("entrepriseId" in contexte) {
    const { data: autorise } = await supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: contexte.entrepriseId });
    const { data: lien } = await supabase
      .from("affectations")
      .select("profil_id")
      .eq("entreprise_id", contexte.entrepriseId)
      .eq("profil_id", profilId)
      .limit(1);
    if (autorise !== true || !lien?.length) return { erreur: "Action non autorisée." };
  } else {
    const { data: autorise } = await supabase.rpc("peut_gerer_cabinet", { p_cabinet_id: contexte.cabinetId });
    const { data: lien } = await supabase
      .from("membres_cabinet")
      .select("profil_id")
      .eq("cabinet_id", contexte.cabinetId)
      .eq("profil_id", profilId);
    if (autorise !== true || !lien?.length) return { erreur: "Action non autorisée." };
  }

  if (!(await reserverEnvoi(`invitation:${profilId}`, 120))) {
    return { erreur: "Une invitation vient d'être envoyée. Patientez 2 minutes avant de réessayer." };
  }
  const resultat = await nouveauLienActivation(profilId);
  if ("erreur" in resultat) return resultat;

  try {
    await envoyerEmail(
      resultat.email,
      emailInvitation({ nom: resultat.nom || resultat.email, perimetre: "votre espace e-Paie", lien: resultat.lien }),
    );
  } catch (erreur) {
    console.error("Renvoi d'invitation impossible :", erreur);
    return { erreur: "L'email n'a pas pu être envoyé. Réessayez plus tard." };
  }
  return { message: `Nouvelle invitation envoyée à ${resultat.email}.` };
}
