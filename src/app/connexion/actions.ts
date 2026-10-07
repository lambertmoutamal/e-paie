"use server";

import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { messageErreurConnexion, validerConnexion, type EtatConnexion } from "@/lib/auth/connexion";

export async function seConnecter(_etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");

  const erreurSaisie = validerConnexion(email, motDePasse);
  if (erreurSaisie) return { erreur: erreurSaisie, email };

  const supabase = await clientSupabaseServeur();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) return { erreur: messageErreurConnexion(error.code, error.status), email };

  redirect("/espace");
}

export async function seDeconnecter() {
  const supabase = await clientSupabaseServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}
