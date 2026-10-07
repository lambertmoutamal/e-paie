"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { definirObligationMotDePasse } from "@/lib/admin/comptes";
import { messageErreurMotDePasse } from "@/lib/auth/mot-de-passe";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaMotDePasse, schemaProfil } from "@/lib/validation/schemas";

export async function modifierProfil(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaProfil, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  // Seule la colonne nom_complet est modifiable par l'utilisateur (droit défini en base).
  const { error } = await supabase
    .from("profils")
    .update({ nom_complet: lu.donnees.nom_complet })
    .eq("id", utilisateur.id);
  if (error) return { erreur: "Le profil n'a pas pu être enregistré.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Profil enregistré." };
}

export async function changerMotDePasse(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaMotDePasse, formulaire);
  // On ne renvoie jamais les mots de passe saisis dans le formulaire.
  if (!lu.ok) return { erreurs: lu.erreurs };

  const { error } = await supabase.auth.updateUser({ password: lu.donnees.mot_de_passe });
  if (error) return { erreur: messageErreurMotDePasse(error.code) };

  if (utilisateur.app_metadata?.mot_de_passe_a_definir) {
    await definirObligationMotDePasse(utilisateur.id, false);
    // Nouveau jeton de session, sans l'obligation de choisir un mot de passe.
    await supabase.auth.refreshSession();
  }
  redirect("/espace");
}
