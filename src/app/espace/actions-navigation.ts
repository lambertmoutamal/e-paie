"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { COOKIE_ENTREPRISE, entreprisesAccessibles, TOUTES } from "@/lib/entreprise-courante";

const OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/espace" };

// Mémorise l'entreprise de travail (ou « toutes ») pour la session en cours.
// Seule une entreprise accessible à la personne peut être choisie.
async function memoriser(entrepriseId: string) {
  const liste = await entreprisesAccessibles();
  const valeur = entrepriseId === TOUTES || entrepriseId === "" ? TOUTES : liste.some((e) => e.id === entrepriseId) ? entrepriseId : null;
  if (valeur) (await cookies()).set(COOKIE_ENTREPRISE, valeur, OPTIONS);
}

// Changement depuis la barre du haut : on reste sur la page
export async function choisirEntreprise(entrepriseId: string) {
  await memoriser(entrepriseId);
  refresh();
}

// Choix à la connexion : on ouvre ensuite le tableau de bord
export async function choisirEntrepriseEtContinuer(entrepriseId: string) {
  await memoriser(entrepriseId);
  redirect("/espace");
}
