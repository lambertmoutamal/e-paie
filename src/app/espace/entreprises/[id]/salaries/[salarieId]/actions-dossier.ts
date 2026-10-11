"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { deposerFichier, supprimerFichier } from "@/lib/stockage/fichiers";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaAvenant, schemaContrat, schemaDocument, schemaFinContrat, schemaRenouvellement } from "@/lib/contrats/regles";

// Toutes les écritures passent par le client de la personne connectée :
// la base vérifie le rôle, l'abonnement et le rattachement salarié ↔ entreprise.

function erreurBase(code?: string): string {
  if (code === "23505") return "Ce salarié a déjà un contrat en cours : terminez-le ou ajoutez un avenant.";
  if (code === "42501") return "Vous n'avez pas le droit de modifier ce dossier.";
  if (code === "23514") return "Les dates ou montants saisis sont incohérents.";
  return "L'enregistrement a échoué.";
}

function fichierDuFormulaire(formulaire: FormData): File | null {
  const f = formulaire.get("fichier");
  return f instanceof File && f.size > 0 ? f : null;
}

// Dépose le fichier joint (facultatif). Renvoie null s'il n'y en a pas.
async function fichierFacultatif(supabase: Awaited<ReturnType<typeof exigerUtilisateur>>["supabase"], entrepriseId: string, salarieId: string, formulaire: FormData) {
  const fichier = fichierDuFormulaire(formulaire);
  if (!fichier) return null;
  return deposerFichier(supabase, entrepriseId, salarieId, fichier);
}

export async function creerContrat(entrepriseId: string, salarieId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaContrat, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const depot = await fichierFacultatif(supabase, entrepriseId, salarieId, formulaire);
  if (depot && "erreur" in depot) return { erreurs: { fichier: depot.erreur }, valeurs: lu.valeurs };

  const { error } = await supabase.from("contrats").insert({
    ...lu.donnees,
    entreprise_id: entrepriseId,
    salarie_id: salarieId,
    fichier_chemin: depot?.chemin ?? null,
    fichier_nom: depot?.nom ?? null,
  });
  if (error) {
    if (depot) await supprimerFichier(supabase, depot.chemin);
    return { erreur: erreurBase(error.code), valeurs: lu.valeurs };
  }
  refresh();
  return { succes: "Contrat enregistré." };
}

export async function activerContrat(entrepriseId: string, contratId: string) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("contrats").update({ statut: "en_cours" }).eq("id", contratId).eq("entreprise_id", entrepriseId).eq("statut", "brouillon");
  refresh();
}

export async function ajouterAvenant(
  entrepriseId: string,
  salarieId: string,
  contratId: string,
  _e: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaAvenant, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data: parent } = await supabase
    .from("contrats")
    .select("id, type_contrat, statut")
    .eq("id", contratId)
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if (!parent || parent.statut !== "en_cours") return { erreur: "Un avenant ne s'ajoute qu'à un contrat en cours." };

  const depot = await fichierFacultatif(supabase, entrepriseId, salarieId, formulaire);
  if (depot && "erreur" in depot) return { erreurs: { fichier: depot.erreur }, valeurs: lu.valeurs };

  const { error } = await supabase.from("contrats").insert({
    ...lu.donnees,
    entreprise_id: entrepriseId,
    salarie_id: salarieId,
    contrat_parent_id: parent.id,
    nature: "avenant",
    type_contrat: parent.type_contrat,
    statut: "en_cours",
    fichier_chemin: depot?.chemin ?? null,
    fichier_nom: depot?.nom ?? null,
  });
  if (error) {
    if (depot) await supprimerFichier(supabase, depot.chemin);
    return { erreur: erreurBase(error.code), valeurs: lu.valeurs };
  }

  // Le contrat porte toujours les conditions en vigueur ; l'avenant garde la trace du changement.
  const changements = Object.fromEntries(
    Object.entries({
      poste: lu.donnees.poste,
      categorie: lu.donnees.categorie,
      salaire_base: lu.donnees.salaire_base,
      heures_hebdo: lu.donnees.heures_hebdo,
      lieu_travail: lu.donnees.lieu_travail,
    }).filter(([, v]) => v !== null),
  );
  await supabase.from("contrats").update(changements).eq("id", parent.id);

  refresh();
  return { succes: "Avenant enregistré et conditions du contrat mises à jour." };
}

export async function renouvelerContrat(
  entrepriseId: string,
  salarieId: string,
  contratId: string,
  _e: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaRenouvellement, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data: ancien } = await supabase
    .from("contrats")
    .select("id, type_contrat, poste, categorie, salaire_base, heures_hebdo, lieu_travail, statut, date_fin_prevue, date_debut")
    .eq("id", contratId)
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if (!ancien || ancien.statut !== "en_cours" || ancien.type_contrat === "cdi") {
    return { erreur: "Seul un contrat à durée déterminée en cours peut être renouvelé." };
  }
  if (lu.donnees.date_debut <= ancien.date_debut) return { erreurs: { date_debut: "Le renouvellement doit commencer après le contrat actuel." }, valeurs: lu.valeurs };

  // 1. Clôture du contrat actuel (la veille du renouvellement), 2. création du nouveau.
  const veille = new Date(`${lu.donnees.date_debut}T00:00:00Z`);
  veille.setUTCDate(veille.getUTCDate() - 1);
  const finAncien = veille.toISOString().slice(0, 10) < ancien.date_debut ? ancien.date_debut : veille.toISOString().slice(0, 10);
  const { error: erreurFin } = await supabase
    .from("contrats")
    .update({ statut: "termine", date_fin_effective: finAncien, motif_fin: "Renouvellement" })
    .eq("id", ancien.id);
  if (erreurFin) return { erreur: erreurBase(erreurFin.code), valeurs: lu.valeurs };

  const { error } = await supabase.from("contrats").insert({
    entreprise_id: entrepriseId,
    salarie_id: salarieId,
    contrat_parent_id: ancien.id,
    nature: "renouvellement",
    type_contrat: ancien.type_contrat,
    poste: ancien.poste,
    categorie: ancien.categorie,
    salaire_base: lu.donnees.salaire_base ?? ancien.salaire_base,
    heures_hebdo: ancien.heures_hebdo,
    lieu_travail: ancien.lieu_travail,
    date_debut: lu.donnees.date_debut,
    date_fin_prevue: lu.donnees.date_fin_prevue,
    statut: "en_cours",
  });
  if (error) {
    // Annule la clôture pour ne pas laisser le salarié sans contrat en cours.
    await supabase.from("contrats").update({ statut: "en_cours", date_fin_effective: null, motif_fin: null }).eq("id", ancien.id);
    return { erreur: erreurBase(error.code), valeurs: lu.valeurs };
  }
  refresh();
  return { succes: "Contrat renouvelé." };
}

export async function terminerContrat(entrepriseId: string, contratId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaFinContrat, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase
    .from("contrats")
    .update(lu.donnees)
    .eq("id", contratId)
    .eq("entreprise_id", entrepriseId)
    .eq("statut", "en_cours")
    .select("id");
  if (error || !data?.length) return { erreur: erreurBase(error?.code ?? "42501"), valeurs: lu.valeurs };
  refresh();
  return { succes: "Fin de contrat enregistrée." };
}

export async function joindreContratSigne(
  entrepriseId: string,
  salarieId: string,
  contratId: string,
  _e: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const { data: contrat } = await supabase
    .from("contrats")
    .select("fichier_chemin")
    .eq("id", contratId)
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if (!contrat) return { erreur: "Contrat introuvable." };

  const depot = await deposerFichier(supabase, entrepriseId, salarieId, fichierDuFormulaire(formulaire));
  if ("erreur" in depot) return { erreurs: { fichier: depot.erreur } };

  const { data, error } = await supabase
    .from("contrats")
    .update({ fichier_chemin: depot.chemin, fichier_nom: depot.nom })
    .eq("id", contratId)
    .select("id");
  if (error || !data?.length) {
    await supprimerFichier(supabase, depot.chemin);
    return { erreur: erreurBase(error?.code ?? "42501") };
  }
  if (contrat.fichier_chemin) await supprimerFichier(supabase, contrat.fichier_chemin);
  refresh();
  return { succes: "Contrat signé enregistré." };
}

export async function ajouterDocument(entrepriseId: string, salarieId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaDocument, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const depot = await deposerFichier(supabase, entrepriseId, salarieId, fichierDuFormulaire(formulaire));
  if ("erreur" in depot) return { erreurs: { fichier: depot.erreur }, valeurs: lu.valeurs };

  const { error } = await supabase.from("documents_salarie").insert({
    ...lu.donnees,
    entreprise_id: entrepriseId,
    salarie_id: salarieId,
    fichier_chemin: depot.chemin,
    fichier_nom: depot.nom,
    taille: depot.taille,
    type_mime: depot.type,
    ajoute_par: utilisateur.id,
  });
  if (error) {
    await supprimerFichier(supabase, depot.chemin);
    return { erreur: erreurBase(error.code), valeurs: lu.valeurs };
  }
  refresh();
  return { succes: "Document ajouté." };
}

export async function supprimerDocument(entrepriseId: string, documentId: string) {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase
    .from("documents_salarie")
    .delete()
    .eq("id", documentId)
    .eq("entreprise_id", entrepriseId)
    .select("fichier_chemin");
  if (data?.[0]) await supprimerFichier(supabase, data[0].fichier_chemin);
  refresh();
}
