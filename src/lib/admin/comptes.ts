import "server-only";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { genererMotDePasseProvisoire } from "@/lib/auth/mot-de-passe";

export type Compte = { id: string; motDePasseProvisoire: string | null };

// Retrouve le compte d'une personne par son email, ou le crée.
// Une même personne peut travailler pour plusieurs entreprises : on ne crée
// jamais de doublon. À n'appeler qu'APRÈS avoir vérifié les droits de l'appelant.
export async function trouverOuCreerCompte(email: string, nomComplet: string): Promise<Compte> {
  const admin = clientSupabaseAdmin();

  const { data: existant, error: erreurLecture } = await admin
    .from("profils")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (erreurLecture) throw erreurLecture;
  if (existant) return { id: existant.id, motDePasseProvisoire: null };

  const motDePasse = genererMotDePasseProvisoire();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom_complet: nomComplet },
    // app_metadata n'est modifiable que par le serveur : l'utilisateur ne peut pas
    // retirer lui-même l'obligation de changer son mot de passe.
    app_metadata: { mot_de_passe_provisoire: true },
  });
  if (error || !data.user) throw error ?? new Error("Création du compte impossible.");
  return { id: data.user.id, motDePasseProvisoire: motDePasse };
}

// Annule la création d'un compte si l'étape suivante a échoué (pas de compte orphelin).
export async function supprimerCompteCree(compte: Compte) {
  if (!compte.motDePasseProvisoire) return;
  await clientSupabaseAdmin().auth.admin.deleteUser(compte.id);
}

export async function leverMotDePasseProvisoire(idUtilisateur: string) {
  const { error } = await clientSupabaseAdmin().auth.admin.updateUserById(idUtilisateur, {
    app_metadata: { mot_de_passe_provisoire: false },
  });
  if (error) throw error;
}
