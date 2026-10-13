"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { messageErreurConnexion, validerConnexion, type EtatConnexion } from "@/lib/auth/connexion";
import { estCookieDeSession } from "@/lib/auth/session";
import { COOKIE_ENTREPRISE } from "@/lib/entreprise-courante";

export async function seConnecter(_etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");

  const erreurSaisie = validerConnexion(email, motDePasse);
  if (erreurSaisie) return { erreur: erreurSaisie, email };

  const supabase = await clientSupabaseServeur();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) return { erreur: messageErreurConnexion(error.code, error.status), email };

  // Nouvelle session : l'entreprise de travail est choisie à chaque connexion
  // (une seule entreprise à la fois, montrée même s'il n'y en a qu'une).
  (await cookies()).delete({ name: COOKIE_ENTREPRISE, path: "/espace" });
  redirect("/espace/choisir-entreprise");
}

export async function seDeconnecter() {
  const supabase = await clientSupabaseServeur();
  // « local » : ferme la session de cet appareil uniquement.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.error("Déconnexion : erreur Supabase :", error.code ?? error.status, error.message);

  // Quoi qu'il arrive (réseau coupé, erreur Supabase), aucun cookie de session ne doit rester.
  const magasinCookies = await cookies();
  for (const { name } of magasinCookies.getAll()) {
    if (estCookieDeSession(name)) magasinCookies.delete(name);
  }
  magasinCookies.delete({ name: COOKIE_ENTREPRISE, path: "/espace" });

  redirect("/connexion");
}
