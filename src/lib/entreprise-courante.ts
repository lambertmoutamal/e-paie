import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";

export const COOKIE_ENTREPRISE = "dematpaie_entreprise";

export type EntrepriseAccessible = { id: string; raison_sociale: string };

// Entreprises que la personne peut voir (la base limite automatiquement la liste).
export const entreprisesAccessibles = cache(async (): Promise<EntrepriseAccessible[]> => {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.from("entreprises").select("id, raison_sociale").order("raison_sociale").limit(500);
  return data ?? [];
});

// Entreprise sur laquelle on travaille : celle choisie dans la barre du haut si elle est
// toujours accessible, sinon la seule accessible, sinon aucune.
export const entrepriseCourante = cache(async (): Promise<EntrepriseAccessible | null> => {
  const liste = await entreprisesAccessibles();
  const choisie = (await cookies()).get(COOKIE_ENTREPRISE)?.value;
  return liste.find((e) => e.id === choisie) ?? (liste.length === 1 ? liste[0] : null);
});
