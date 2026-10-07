"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { affecterPersonne } from "@/lib/admin/membres";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import {
  schemaEntreprise,
  schemaNouvelleAffectation,
  schemaNouvelleEntreprise,
} from "@/lib/validation/schemas";
import { libelleRole } from "@/lib/auth/roles";

export async function creerEntreprise(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaNouvelleEntreprise, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  // La RLS refuse si la personne n'est ni admin plateforme ni admin de ce cabinet.
  const { data, error } = await supabase.from("entreprises").insert(lu.donnees).select("id").single();
  if (error || !data) {
    return { erreur: "L'entreprise n'a pas pu être créée (droits insuffisants sur ce cabinet ?).", valeurs: lu.valeurs };
  }
  redirect(`/espace/entreprises/${data.id}`);
}

export async function modifierEntreprise(
  entrepriseId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaEntreprise, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase
    .from("entreprises")
    .update(lu.donnees)
    .eq("id", entrepriseId)
    .select("id");
  if (error || !data?.length) return { erreur: "Modification refusée ou impossible.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Fiche enregistrée." };
}

export async function ajouterUtilisateur(
  entrepriseId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaNouvelleAffectation, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { email, nom_complet, role } = lu.donnees;
  const resultat = await affecterPersonne(supabase, entrepriseId, email, nom_complet, role);
  if ("erreur" in resultat) return { erreur: resultat.erreur, valeurs: lu.valeurs };

  refresh();
  return { succes: `${nom_complet} : ${libelleRole(role)}.`, compteCree: resultat.compteCree };
}

// Retirer un accès ne supprime rien : l'affectation est désactivée (et tracée).
export async function changerAcces(entrepriseId: string, profilId: string, role: string, actif: boolean) {
  const { supabase } = await exigerUtilisateur();
  await supabase
    .from("affectations")
    .update({ actif })
    .eq("entreprise_id", entrepriseId)
    .eq("profil_id", profilId)
    .eq("role", role);
  refresh();
}
