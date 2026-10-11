"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaModele } from "@/lib/contrats/regles";
import { nettoyerHtml } from "@/lib/contrats/document";

// Écritures avec le client de la personne connectée : la base vérifie qu'elle peut
// gérer les salariés de l'entreprise. Les modèles standard sont en lecture seule.

export async function creerModele(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaModele, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { data, error } = await supabase
    .from("modeles_contrat")
    .insert({ ...lu.donnees, contenu: nettoyerHtml(lu.donnees.contenu) || "<p></p>", entreprise_id: entrepriseId, cree_par: utilisateur.id })
    .select("id")
    .single();
  if (error) return { erreur: "Le modèle n'a pas pu être créé.", valeurs: lu.valeurs };
  redirect(`/espace/entreprises/${entrepriseId}/modeles-contrat/${data.id}`);
}

// Copie d'un modèle standard dans l'entreprise, pour le personnaliser
export async function personnaliserModele(entrepriseId: string, modeleId: string) {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const { data: source } = await supabase.from("modeles_contrat").select("nom, categorie, type_contrat, contenu").eq("id", modeleId).maybeSingle();
  if (!source) return;
  const { data, error } = await supabase
    .from("modeles_contrat")
    .insert({
      ...source,
      nom: source.nom.replace(" — modèle standard", "").slice(0, 120),
      entreprise_id: entrepriseId,
      cree_par: utilisateur.id,
    })
    .select("id")
    .single();
  if (error) return;
  redirect(`/espace/entreprises/${entrepriseId}/modeles-contrat/${data.id}`);
}

export async function enregistrerModele(modeleId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaModele, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs };
  const { data, error } = await supabase
    .from("modeles_contrat")
    .update({ ...lu.donnees, contenu: nettoyerHtml(lu.donnees.contenu) || "<p></p>", modifie_le: new Date().toISOString() })
    .eq("id", modeleId)
    .select("id");
  if (error || !data?.length) return { erreur: "Le modèle n'a pas pu être enregistré." };
  refresh();
  return { succes: "Modèle enregistré." };
}

export async function basculerModele(modeleId: string, actif: boolean) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("modeles_contrat").update({ actif, modifie_le: new Date().toISOString() }).eq("id", modeleId);
  refresh();
}
