import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supprimerCompteCree, trouverOuCreerCompte } from "./comptes";
import type { EtatFormulaire } from "@/lib/validation/formulaire";

type Resultat = { erreur: string } | { compteCree?: NonNullable<EtatFormulaire>["compteCree"] };

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

  const compte = await trouverOuCreerCompte(email, nomComplet);
  const { error } = await supabase
    .from("membres_cabinet")
    .insert({ cabinet_id: cabinetId, profil_id: compte.id });
  if (error) {
    await supprimerCompteCree(compte);
    return {
      erreur:
        error.code === "23505"
          ? "Cette personne est déjà administrateur de ce cabinet."
          : "L'administrateur n'a pas pu être ajouté.",
    };
  }
  return { compteCree: compte.motDePasseProvisoire ? { email, motDePasse: compte.motDePasseProvisoire } : undefined };
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
  return { compteCree: compte.motDePasseProvisoire ? { email, motDePasse: compte.motDePasseProvisoire } : undefined };
}
