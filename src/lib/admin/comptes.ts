import "server-only";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { lienConfirmation, type TypeLien } from "@/lib/email/envoyer";

export type Compte = { id: string; nouveau: boolean; lienActivation: string | null };

// Retrouve le compte d'une personne par son email, ou le crée en mode « invité » :
// aucun mot de passe n'existe tant qu'elle n'a pas cliqué sur son lien d'activation
// (ce qui prouve que la boîte mail lui appartient). Une même personne peut travailler
// pour plusieurs entreprises : jamais de doublon.
// À n'appeler qu'APRÈS avoir vérifié les droits de l'appelant.
export async function trouverOuCreerCompte(email: string, nomComplet: string): Promise<Compte> {
  const admin = clientSupabaseAdmin();

  const { data: existant, error: erreurLecture } = await admin
    .from("profils")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (erreurLecture) throw erreurLecture;
  if (existant) return { id: existant.id, nouveau: false, lienActivation: null };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { nom_complet: nomComplet } },
  });
  if (error || !data.user) throw error ?? new Error("Création du compte impossible.");

  // app_metadata n'est modifiable que par le serveur : la personne ne peut pas
  // contourner l'obligation de choisir son mot de passe.
  await definirObligationMotDePasse(data.user.id, true);

  return {
    id: data.user.id,
    nouveau: true,
    lienActivation: lienConfirmation(data.properties.hashed_token, "invite"),
  };
}

// Annule la création d'un compte si l'étape suivante a échoué (pas de compte orphelin).
export async function supprimerCompteCree(compte: Compte) {
  if (!compte.nouveau) return;
  await clientSupabaseAdmin().auth.admin.deleteUser(compte.id);
}

export async function definirObligationMotDePasse(idUtilisateur: string, obligatoire: boolean) {
  const { error } = await clientSupabaseAdmin().auth.admin.updateUserById(idUtilisateur, {
    app_metadata: { mot_de_passe_a_definir: obligatoire },
  });
  if (error) throw error;
}

// Nouveau lien pour une personne qui n'a pas encore activé son compte.
export async function nouveauLienActivation(
  idUtilisateur: string,
): Promise<{ erreur: string } | { email: string; nom: string; lien: string }> {
  const admin = clientSupabaseAdmin();
  const { data, error } = await admin.auth.admin.getUserById(idUtilisateur);
  if (error || !data.user?.email) return { erreur: "Compte introuvable." };
  if (data.user.last_sign_in_at) return { erreur: "Ce compte est déjà activé." };

  const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: data.user.email,
  });
  if (erreurLien || !lien.properties) return { erreur: "Le lien n'a pas pu être généré." };

  return {
    email: data.user.email,
    nom: String(data.user.user_metadata?.nom_complet ?? ""),
    lien: lienConfirmation(lien.properties.hashed_token, lien.properties.verification_type as TypeLien),
  };
}

// Lien « mot de passe oublié ». Renvoie null si aucun compte n'existe
// (l'appelant ne doit pas révéler cette information).
export async function lienReinitialisation(email: string): Promise<string | null> {
  const admin = clientSupabaseAdmin();
  const { data: profil } = await admin.from("profils").select("id").eq("email", email).maybeSingle();
  if (!profil) return null;

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties) return null;
  return lienConfirmation(data.properties.hashed_token, "recovery");
}

// Anti-abus : au plus un email par clé (personne, adresse) pendant le délai donné.
export async function reserverEnvoi(cle: string, delaiSecondes: number): Promise<boolean> {
  const { data } = await clientSupabaseAdmin().rpc("reserver_envoi_email", {
    p_cle: cle,
    p_delai_secondes: delaiSecondes,
  });
  return data === true;
}
