import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifierFichier } from "@/lib/contrats/regles";

const EXTENSIONS: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// Pièce jointe d'une réclamation, rangée dans le dossier du salarié (espace privé « reclamations »).
// Déposée au nom de la personne connectée : la base vérifie qu'elle en a le droit.
export async function deposerPiece(
  supabase: SupabaseClient,
  entrepriseId: string,
  salarieId: string,
  formulaire: FormData,
): Promise<{ erreur: string } | { chemin: string; nom: string } | null> {
  const fichier = formulaire.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return null;
  const probleme = verifierFichier(fichier);
  if (probleme) return { erreur: probleme };
  const chemin = `${entrepriseId}/${salarieId}/${randomUUID()}.${EXTENSIONS[fichier.type] ?? "pdf"}`;
  const { error } = await supabase.storage.from("reclamations").upload(chemin, fichier, { contentType: fichier.type, upsert: false });
  if (error) return { erreur: "La pièce jointe n'a pas pu être envoyée." };
  return { chemin, nom: fichier.name.slice(0, 200) };
}

export async function retirerPiece(supabase: SupabaseClient, chemin: string) {
  await supabase.storage.from("reclamations").remove([chemin]).catch(() => {});
}
