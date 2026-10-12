import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";

export const COOKIE_ENTREPRISE = "dematpaie_entreprise";
// Valeur du cookie quand la personne a choisi de voir toutes ses entreprises
export const TOUTES = "toutes";

export type EntrepriseAccessible = { id: string; raison_sociale: string };

// Entreprises que la personne peut voir (la base limite automatiquement la liste).
export const entreprisesAccessibles = cache(async (): Promise<EntrepriseAccessible[]> => {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.from("entreprises").select("id, raison_sociale").order("raison_sociale").limit(500);
  return data ?? [];
});

// Entreprise sur laquelle on travaille : celle choisie (si toujours accessible),
// sinon la seule accessible, sinon aucune (vue de toutes les entreprises).
export const entrepriseCourante = cache(async (): Promise<EntrepriseAccessible | null> => {
  const liste = await entreprisesAccessibles();
  const choisie = (await cookies()).get(COOKIE_ENTREPRISE)?.value;
  return liste.find((e) => e.id === choisie) ?? (liste.length === 1 ? liste[0] : null);
});

// Le choix a-t-il été fait depuis la connexion ? (inutile avec une seule entreprise)
export const choixEntrepriseFait = cache(async (): Promise<boolean> => {
  const liste = await entreprisesAccessibles();
  if (liste.length <= 1) return true;
  const choisie = (await cookies()).get(COOKIE_ENTREPRISE)?.value;
  return choisie === TOUTES || liste.some((e) => e.id === choisie);
});
