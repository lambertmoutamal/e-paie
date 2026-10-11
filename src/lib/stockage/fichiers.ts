import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cheminFichier, verifierFichier } from "@/lib/contrats/regles";

export const COMPARTIMENT = "documents";

// Dépose un fichier dans l'espace privé, au nom de la personne connectée :
// les règles de la base vérifient qu'elle peut écrire pour cette entreprise.
export async function deposerFichier(
  supabase: SupabaseClient,
  entrepriseId: string,
  salarieId: string,
  fichier: File | null,
): Promise<{ erreur: string } | { chemin: string; nom: string; taille: number; type: string }> {
  const probleme = verifierFichier(fichier);
  if (probleme || !fichier) return { erreur: probleme ?? "Choisissez un fichier." };

  const chemin = cheminFichier(entrepriseId, salarieId, fichier.name, randomUUID());
  const { error } = await supabase.storage.from(COMPARTIMENT).upload(chemin, fichier, {
    contentType: fichier.type,
    upsert: false,
  });
  if (error) {
    console.error("Dépôt de fichier impossible :", error);
    return { erreur: "Le fichier n'a pas pu être enregistré." };
  }
  return { chemin, nom: fichier.name.slice(0, 200), taille: fichier.size, type: fichier.type };
}

export async function supprimerFichier(supabase: SupabaseClient, chemin: string) {
  await supabase.storage.from(COMPARTIMENT).remove([chemin]);
}
