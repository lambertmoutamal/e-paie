"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { deposerFichier, supprimerFichier } from "@/lib/stockage/fichiers";
import { informerSalarie } from "@/lib/notifications/alertes-absences";
import {
  schemaJourFerie,
  schemaParametresConges,
  schemaSaisieRh,
  schemaSoldeInitial,
  schemaTypeAbsence,
} from "@/lib/absences/regles";

// Toutes les écritures passent par le client de la personne connectée :
// la base vérifie qu'elle est RH ou administrateur de l'entreprise.

// Les fonctions de la base renvoient des messages clairs (code P0001).
function message(error: { code?: string; message: string }, defaut: string) {
  return error.code === "P0001" ? error.message : defaut;
}

export async function deciderDemande(demandeId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const accepter = formulaire.get("decision") === "accepter";
  const commentaire = String(formulaire.get("commentaire") ?? "").trim().slice(0, 500);
  if (!accepter && commentaire.length < 5) {
    return { erreurs: { commentaire: "Expliquez le motif du refus (5 caractères au moins)." }, valeurs: { commentaire } };
  }
  const { error } = await supabase.rpc("decider_demande", { p_demande_id: demandeId, p_accepter: accepter, p_commentaire: commentaire || null });
  if (error) return { erreur: message(error, "La réponse n'a pas pu être enregistrée."), valeurs: { commentaire } };
  after(() => informerSalarie(demandeId));
  refresh();
  return { succes: accepter ? "Demande acceptée. Le salarié est prévenu." : "Demande refusée. Le salarié est prévenu." };
}

export async function saisirAbsence(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaSaisieRh, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const fichier = formulaire.get("fichier");
  let justificatif: string | null = null;
  if (fichier instanceof File && fichier.size > 0) {
    const depot = await deposerFichier(supabase, entrepriseId, lu.donnees.salarie_id, fichier, "absences");
    if ("erreur" in depot) return { erreurs: { fichier: depot.erreur }, valeurs: lu.valeurs };
    justificatif = depot.chemin;
  }

  const { data, error } = await supabase.rpc("saisir_absence", {
    p_salarie_id: lu.donnees.salarie_id,
    p_type_id: lu.donnees.type_id,
    p_debut: lu.donnees.debut,
    p_fin: lu.donnees.fin,
    p_debut_apres_midi: lu.donnees.debut_apres_midi,
    p_fin_midi: lu.donnees.fin_midi,
    p_motif: lu.donnees.motif,
    p_justificatif: justificatif,
  });
  if (error) {
    if (justificatif) await supprimerFichier(supabase, justificatif, "absences");
    return { erreur: message(error, "L'absence n'a pas pu être enregistrée."), valeurs: lu.valeurs };
  }
  after(() => informerSalarie(data as string));
  refresh();
  return { succes: "Absence enregistrée. Le salarié est prévenu." };
}

export async function annulerAbsence(demandeId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const commentaire = String(formulaire.get("commentaire") ?? "").trim();
  const { error } = await supabase.rpc("annuler_absence", { p_demande_id: demandeId, p_commentaire: commentaire });
  if (error) return { erreur: message(error, "L'annulation a échoué.") };
  after(() => informerSalarie(demandeId));
  refresh();
  return { succes: "Absence annulée." };
}

export async function definirSoldeInitial(salarieId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaSoldeInitial, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { error } = await supabase.rpc("definir_solde_initial", {
    p_salarie_id: salarieId,
    p_date_reference: lu.donnees.date_reference,
    p_jours: lu.donnees.jours,
  });
  if (error) return { erreur: message(error, "Le solde n'a pas pu être enregistré."), valeurs: lu.valeurs };
  refresh();
  return { succes: "Solde de départ enregistré." };
}

export async function modifierParametres(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaParametresConges, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { data, error } = await supabase
    .from("parametres_conges")
    .update({ ...lu.donnees, modifie_le: new Date().toISOString() })
    .eq("entreprise_id", entrepriseId)
    .select("entreprise_id");
  if (error || !data?.length) return { erreur: "Vous ne pouvez pas modifier ces réglages.", valeurs: lu.valeurs };
  refresh();
  return { succes: "Réglages enregistrés. Les soldes sont recalculés." };
}

export async function ajouterTypeAbsence(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaTypeAbsence, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { error } = await supabase.from("types_absence").insert({ ...lu.donnees, entreprise_id: entrepriseId });
  if (error) {
    return { erreur: error.code === "23505" ? "Ce type existe déjà." : "Le type n'a pas pu être ajouté.", valeurs: lu.valeurs };
  }
  refresh();
  return { succes: "Type d'absence ajouté." };
}

export async function basculerTypeAbsence(typeId: string, actif: boolean) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("types_absence").update({ actif }).eq("id", typeId);
  refresh();
}

export async function ajouterJourFerie(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaJourFerie, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { error } = await supabase.from("jours_feries").insert({ ...lu.donnees, entreprise_id: entrepriseId });
  if (error) {
    return { erreur: error.code === "23505" ? "Ce jour férié est déjà enregistré." : "Le jour férié n'a pas pu être ajouté.", valeurs: lu.valeurs };
  }
  refresh();
  return { succes: "Jour férié ajouté." };
}

export async function retirerJourFerie(ferieId: string) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("jours_feries").delete().eq("id", ferieId);
  refresh();
}
