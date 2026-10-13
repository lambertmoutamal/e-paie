import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";

import { COOKIE_ENTREPRISE } from "@/lib/entreprise-chemins";

export { COOKIE_ENTREPRISE };

export type EntrepriseAccessible = { id: string; raison_sociale: string };

// Entreprises que la personne peut voir (la base limite automatiquement la liste).
export const entreprisesAccessibles = cache(async (): Promise<EntrepriseAccessible[]> => {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.from("entreprises").select("id, raison_sociale").order("raison_sociale").limit(500);
  return data ?? [];
});

// Entreprise sur laquelle on travaille : celle choisie à la connexion, si elle est
// toujours accessible. On ne travaille jamais sur plusieurs entreprises à la fois.
export const entrepriseCourante = cache(async (): Promise<EntrepriseAccessible | null> => {
  const liste = await entreprisesAccessibles();
  const choisie = (await cookies()).get(COOKIE_ENTREPRISE)?.value;
  return liste.find((e) => e.id === choisie) ?? null;
});

// Pour les pages de travail : sans entreprise choisie, retour à l'écran de choix.
export async function exigerEntrepriseCourante(): Promise<EntrepriseAccessible> {
  const courante = await entrepriseCourante();
  if (!courante) redirect("/espace/choisir-entreprise");
  return courante;
}
