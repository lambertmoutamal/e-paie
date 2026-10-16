"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { COOKIE_ENTREPRISE, entreprisesAccessibles } from "@/lib/entreprise-courante";

const OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/espace" };

// Mémorise l'entreprise de travail pour la session en cours (une seule à la fois).
// Seule une entreprise accessible à la personne peut être choisie.
async function memoriser(entrepriseId: string) {
  const liste = await entreprisesAccessibles();
  if (liste.some((e) => e.id === entrepriseId)) (await cookies()).set(COOKIE_ENTREPRISE, entrepriseId, OPTIONS);
}

// Choix sur l'écran des entreprises : on ouvre ensuite le tableau de bord
export async function choisirEntrepriseEtContinuer(entrepriseId: string) {
  await memoriser(entrepriseId);
  redirect("/espace");
}

// Ouverture d'une page d'une autre entreprise (lien d'une alerte, par exemple) : on bascule
// sur cette entreprise, après confirmation, et on reste sur la page.
export async function basculerEntreprise(entrepriseId: string) {
  await memoriser(entrepriseId);
  refresh();
}

// « Changer d'entreprise » : on quitte l'entreprise actuelle (plus aucune page de travail
// accessible) et on revient à l'écran de choix.
export async function changerEntreprise() {
  (await cookies()).delete({ name: COOKIE_ENTREPRISE, path: "/espace" });
  redirect("/choix-entreprise");
}
