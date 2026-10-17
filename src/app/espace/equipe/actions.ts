"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { affecterCollaborateur, ajouterAdminCabinet, retirerAdminCabinet } from "@/lib/admin/membres";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaAffectationEquipe, schemaNouveauMembre } from "@/lib/validation/schemas";

// Affecte un collaborateur du cabinet, avec une tâche, à une ou plusieurs entreprises clientes.
export async function affecterMembreEquipe(cabinetId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaAffectationEquipe, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  // Cases cochées : « entreprise:<id> »
  const entrepriseIds = [...formulaire.keys()].filter((cle) => cle.startsWith("entreprise:")).map((cle) => cle.slice("entreprise:".length));

  const { email, nom_complet, role } = lu.donnees;
  const resultat = await affecterCollaborateur(supabase, cabinetId, entrepriseIds, email, nom_complet, role);
  if ("erreur" in resultat) return { erreur: resultat.erreur, valeurs: lu.valeurs };
  refresh();
  return { succes: resultat.message };
}

export async function ajouterAdminEquipe(cabinetId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaNouveauMembre, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const resultat = await ajouterAdminCabinet(supabase, cabinetId, lu.donnees.email, lu.donnees.nom_complet);
  if ("erreur" in resultat) return { erreur: resultat.erreur, valeurs: lu.valeurs };
  refresh();
  return { succes: resultat.message };
}

export async function retirerAdminEquipe(cabinetId: string, profilId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const resultat = await retirerAdminCabinet(supabase, cabinetId, profilId);
  if ("erreur" in resultat) return { erreur: resultat.erreur };
  refresh();
  return { succes: resultat.message };
}
