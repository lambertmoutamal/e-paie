"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { COOKIE_ENTREPRISE, entreprisesAccessibles } from "@/lib/entreprise-courante";

// Choix de l'entreprise de travail (mémorisé sur cet appareil). Seule une entreprise
// accessible à la personne peut être choisie.
export async function choisirEntreprise(entrepriseId: string) {
  const liste = await entreprisesAccessibles();
  const magasin = await cookies();
  if (!entrepriseId) {
    magasin.delete(COOKIE_ENTREPRISE);
  } else if (liste.some((e) => e.id === entrepriseId)) {
    magasin.set(COOKIE_ENTREPRISE, entrepriseId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/espace", maxAge: 60 * 60 * 24 * 365 });
  }
  refresh();
}
