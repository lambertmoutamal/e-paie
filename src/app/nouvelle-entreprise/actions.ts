"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { messageErreurConnexion, validerConnexion } from "@/lib/auth/connexion";
import { COOKIE_ENTREPRISE } from "@/lib/entreprise-chemins";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaEntreprise } from "@/lib/validation/schemas";

// Ajout d'une entreprise cliente depuis la page de connexion (jamais depuis l'espace) :
// le cabinet s'identifie, puis l'entreprise est créée et rattachée à son cabinet.
// La base vérifie elle-même que la personne administre bien ce cabinet.
export async function creerEntrepriseDepuisConnexion(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");
  const lu = lireFormulaire(schemaEntreprise, formulaire);
  // Le mot de passe n'est jamais renvoyé à l'écran
  const { mot_de_passe: _ignore, ...valeurs } = lu.valeurs;
  void _ignore;

  const erreurSaisie = validerConnexion(email, motDePasse);
  if (erreurSaisie) return { erreur: erreurSaisie, valeurs };
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs };

  const supabase = await clientSupabaseServeur();
  const { data: session, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error || !session.user) return { erreur: messageErreurConnexion(error?.code, error?.status), valeurs };
  const refuser = async (message: string): Promise<EtatFormulaire> => {
    await supabase.auth.signOut({ scope: "local" });
    return { erreur: message, valeurs };
  };
  if (session.user.app_metadata?.type === "salarie") return refuser("Ce compte est un compte salarié : il ne peut pas créer d'entreprise.");

  // Cabinet de rattachement : celui que la personne administre (le nom est demandé s'il y en a plusieurs)
  const [{ data: profil }, { data: membres }] = await Promise.all([
    supabase.from("profils").select("est_admin_plateforme").eq("id", session.user.id).single(),
    supabase.from("membres_cabinet").select("cabinet_id, cabinets(nom)").eq("profil_id", session.user.id),
  ]);
  const { data: tous } = profil?.est_admin_plateforme ? await supabase.from("cabinets").select("cabinet_id:id, nom") : { data: null };
  const cabinets = (tous ?? (membres ?? []).map((m) => ({ cabinet_id: m.cabinet_id, nom: (m.cabinets as unknown as { nom: string } | null)?.nom ?? "" }))) as { cabinet_id: string; nom: string }[];
  if (!cabinets.length) {
    return refuser("Ce compte ne gère aucun cabinet comptable. Pour une entreprise qui fait sa propre paie, créez un compte avec « Essayer gratuitement 30 jours ».");
  }
  const nomCabinet = String(formulaire.get("cabinet") ?? "").trim().toLowerCase();
  const cabinet = cabinets.length === 1 ? cabinets[0] : cabinets.find((c) => c.nom.trim().toLowerCase() === nomCabinet);
  if (!cabinet) {
    return refuser(`Vous gérez plusieurs cabinets : indiquez lequel dans « Nom du cabinet » (${cabinets.map((c) => c.nom).slice(0, 5).join(", ")}).`);
  }

  const { data: entreprise, error: erreurCreation } = await supabase
    .from("entreprises")
    .insert({ ...lu.donnees, cabinet_id: cabinet.cabinet_id })
    .select("id")
    .single();
  if (erreurCreation || !entreprise) {
    console.error("Création d'entreprise impossible :", erreurCreation?.code, erreurCreation?.message);
    return refuser("L'entreprise n'a pas pu être créée : seul un administrateur du cabinet peut ajouter une entreprise.");
  }

  // La nouvelle entreprise devient l'entreprise de travail
  (await cookies()).set(COOKIE_ENTREPRISE, entreprise.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/espace" });
  redirect(`/espace/entreprises/${entreprise.id}`);
}
