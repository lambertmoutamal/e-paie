"use server";

import { createHash, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { alerterPaie } from "@/lib/notifications/alertes-paie";
import { envoyerAvisBulletins, type BilanAvis } from "@/lib/notifications/avis-bulletins";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { estPdf, libellePeriode, lireCircuit, schemaPeriode, TAILLE_MAX_BULLETIN } from "@/lib/bulletins/regles";
import { compterPages } from "@/lib/bulletins/pages";

// Toutes les écritures passent par le client de la personne connectée :
// la base vérifie le rôle, l'abonnement, l'entreprise et que la période est en brouillon.

const ESPACE = "bulletins";

export async function creerPeriode(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaPeriode, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { annee, mois } = lu.donnees.periode;
  const { data, error } = await supabase
    .from("periodes_paie")
    .insert({ entreprise_id: entrepriseId, annee, mois, cree_par: utilisateur.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { erreur: `La période ${libellePeriode(annee, mois)} existe déjà.`, valeurs: lu.valeurs };
    if (error.code === "42501") return { erreur: "Vous n'avez pas le droit de créer une période pour cette entreprise.", valeurs: lu.valeurs };
    return { erreur: "La période n'a pas pu être créée.", valeurs: lu.valeurs };
  }
  redirect(`/espace/entreprises/${entrepriseId}/paie/${data.id}`);
}

// Une période ne se supprime que si elle est vide (les bulletins la retiennent dans la base).
export async function supprimerPeriode(entrepriseId: string, periodeId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const { data, error } = await supabase
    .from("periodes_paie")
    .delete()
    .eq("id", periodeId)
    .eq("entreprise_id", entrepriseId)
    .select("id");
  if (error?.code === "23503") return { erreur: "Cette période contient des bulletins ou un historique de validation : elle est conservée." };
  if (error || !data?.length) return { erreur: "Cette période ne peut pas être supprimée." };
  redirect(`/espace/entreprises/${entrepriseId}/paie`);
}

export type ResultatDepot = { ok: true; remplace: boolean } | { ok: false; erreur: string };

// Dépose (ou remplace) le bulletin d'un salarié. Appelé une fois par fichier,
// y compris lors d'un dépôt en masse (le navigateur envoie les fichiers un par un).
export async function deposerBulletin(
  entrepriseId: string,
  periodeId: string,
  salarieId: string,
  formulaire: FormData,
): Promise<ResultatDepot> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const fichier = formulaire.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, erreur: "Choisissez un fichier PDF." };
  if (fichier.size > TAILLE_MAX_BULLETIN) return { ok: false, erreur: "Fichier trop lourd (2 Mo maximum)." };

  // On vérifie le contenu réel du fichier, pas seulement son nom.
  const contenu = new Uint8Array(await fichier.arrayBuffer());
  if (!estPdf(contenu)) return { ok: false, erreur: "Ce fichier n'est pas un vrai PDF." };
  // Un bulletin = une seule page : un salarié ne doit jamais recevoir la page d'un collègue.
  const pages = await compterPages(contenu);
  if (pages === null) return { ok: false, erreur: "Ce PDF est illisible ou endommagé." };
  if (pages !== 1) return { ok: false, erreur: `Un bulletin doit tenir sur une seule page : ce PDF en contient ${pages}.` };
  const empreinte = createHash("sha256").update(contenu).digest("hex");

  const [{ data: periode }, { data: salarie }, { data: existant }] = await Promise.all([
    supabase.from("periodes_paie").select("statut").eq("id", periodeId).eq("entreprise_id", entrepriseId).maybeSingle(),
    supabase.from("salaries").select("id").eq("id", salarieId).eq("entreprise_id", entrepriseId).maybeSingle(),
    supabase
      .from("bulletins")
      .select("id, fichier_chemin")
      .eq("periode_id", periodeId)
      .eq("salarie_id", salarieId)
      .eq("type", "normal")
      .maybeSingle(),
  ]);
  if (!periode || !salarie) return { ok: false, erreur: "Période ou salarié introuvable." };
  if (periode.statut !== "brouillon") return { ok: false, erreur: "Cette période est verrouillée : elle n'est plus en brouillon." };

  const chemin = `${entrepriseId}/${periodeId}/${salarieId}-${randomUUID()}.pdf`;
  const { error: erreurStockage } = await supabase.storage
    .from(ESPACE)
    .upload(chemin, contenu, { contentType: "application/pdf", upsert: false });
  if (erreurStockage) {
    console.error("Dépôt de bulletin impossible :", erreurStockage);
    return { ok: false, erreur: "Le fichier n'a pas pu être enregistré (droits insuffisants ou période verrouillée)." };
  }

  const fiche = {
    fichier_chemin: chemin,
    fichier_nom: fichier.name.slice(0, 200),
    taille: fichier.size,
    empreinte_sha256: empreinte,
    depose_par: utilisateur.id,
    depose_le: new Date().toISOString(),
  };
  const { error } = existant
    ? await supabase.from("bulletins").update(fiche).eq("id", existant.id)
    : await supabase.from("bulletins").insert({ ...fiche, entreprise_id: entrepriseId, periode_id: periodeId, salarie_id: salarieId });
  if (error) {
    await supabase.storage.from(ESPACE).remove([chemin]);
    if (error.code === "23505") return { ok: false, erreur: "Ce salarié a déjà un bulletin pour cette période." };
    return { ok: false, erreur: "Le bulletin n'a pas pu être enregistré." };
  }
  // L'ancien fichier remplacé n'est plus référencé : on le retire du stockage.
  if (existant) await supabase.storage.from(ESPACE).remove([existant.fichier_chemin]);
  return { ok: true, remplace: Boolean(existant) };
}

export async function retirerBulletin(entrepriseId: string, bulletinId: string) {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase
    .from("bulletins")
    .delete()
    .eq("id", bulletinId)
    .eq("entreprise_id", entrepriseId)
    .select("fichier_chemin");
  if (data?.[0]) await supabase.storage.from(ESPACE).remove([data[0].fichier_chemin]);
  refresh();
}

// Annulation du dépôt : tous les bulletins de la période sont retirés, tant qu'elle n'a pas
// été envoyée en validation. Après l'envoi, seul un refus du validateur la rouvre ; elle
// revient alors en brouillon chez la personne qui l'a préparée (modifier ou supprimer).
// La base n'autorise le retrait qu'à qui dépose les bulletins, et seulement en brouillon.
export async function annulerDepot(entrepriseId: string, periodeId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const { data: periode } = await supabase.from("periodes_paie").select("statut").eq("id", periodeId).eq("entreprise_id", entrepriseId).maybeSingle();
  if (!periode) return { erreur: "Période introuvable." };
  if (periode.statut !== "brouillon") {
    return { erreur: "La paie a été envoyée en validation : le dépôt ne peut plus être annulé. Seul un validateur peut la refuser." };
  }
  const { data, error } = await supabase.from("bulletins").delete().eq("periode_id", periodeId).eq("entreprise_id", entrepriseId).select("fichier_chemin");
  if (error) return { erreur: "Le dépôt n'a pas pu être annulé." };
  if (!data?.length) return { erreur: "Aucun bulletin retiré : vous ne pouvez pas annuler ce dépôt." };
  const chemins = data.map((b) => b.fichier_chemin);
  for (let i = 0; i < chemins.length; i += 100) await supabase.storage.from(ESPACE).remove(chemins.slice(i, i + 100));
  refresh();
  return { succes: `Dépôt annulé : ${data.length} bulletin(s) retiré(s).` };
}

// ---------------------------------------------------------------------
// Circuit de validation (les règles sont appliquées par la base)
// ---------------------------------------------------------------------

// Message clair renvoyé par les fonctions du circuit (code P0001), sinon message générique.
function messageCircuit(error: { code?: string; message: string }, defaut: string) {
  return error.code === "P0001" ? error.message : defaut;
}

export async function definirCircuit(entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireCircuit(formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, erreur: lu.erreurs._, valeurs: lu.valeurs };
  const { error } = await supabase.rpc("definir_circuit", { p_entreprise_id: entrepriseId, p_etapes: lu.etapes });
  if (error) return { erreur: messageCircuit(error, "Le circuit n'a pas pu être enregistré.") };
  refresh();
  return { succes: "Circuit enregistré. Il s'appliquera aux prochaines périodes envoyées en validation." };
}

export async function soumettrePeriode(periodeId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const { error } = await supabase.rpc("soumettre_periode", { p_periode_id: periodeId });
  if (error) return { erreur: messageCircuit(error, "L'envoi en validation a échoué.") };
  after(() => alerterPaie(periodeId)); // prévient les validateurs de la 1re étape
  refresh();
  return { succes: "Période envoyée en validation." };
}

// Validation ou refus de l'étape en cours (le bouton cliqué indique la décision).
export async function deciderEtape(periodeId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const decision = formulaire.get("decision");
  const commentaire = String(formulaire.get("commentaire") ?? "").trim().slice(0, 1000);
  const valeurs = { commentaire };

  if (decision === "refuser") {
    if (commentaire.length < 5) return { erreurs: { commentaire: "Expliquez le motif du refus (5 caractères au moins)." }, valeurs };
    const { data, error } = await supabase.rpc("refuser_etape", { p_periode_id: periodeId, p_commentaire: commentaire });
    if (error) return { erreur: messageCircuit(error, "Le refus n'a pas pu être enregistré."), valeurs };
    after(() => alerterPaie(periodeId)); // prévient l'étape précédente ou le gestionnaire
    refresh();
    return { succes: data === "brouillon" ? "Période refusée : elle revient en brouillon pour correction." : "Refus enregistré : la période revient à l'étape précédente." };
  }
  if (decision !== "valider") return { erreur: "Choisissez Valider ou Refuser.", valeurs };

  const { data, error } = await supabase.rpc("valider_etape", { p_periode_id: periodeId, p_commentaire: commentaire || null });
  if (error) return { erreur: messageCircuit(error, "La validation n'a pas pu être enregistrée."), valeurs };
  after(() => alerterPaie(periodeId)); // prévient l'étape suivante, ou les publieurs si approuvée
  refresh();
  return { succes: data === "approuvee" ? "Période approuvée : elle est désormais verrouillée." : "Étape validée : la période passe à l'étape suivante." };
}

export async function publierPeriode(periodeId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const { data, error } = await supabase.rpc("publier_periode", { p_periode_id: periodeId });
  if (error) return { erreur: messageCircuit(error, "La publication a échoué.") };
  // Avis WhatsApp aux salariés qui l'ont accepté (après la réponse : la page n'attend pas)
  after(() => envoyerAvisBulletins(periodeId).catch((e) => console.error("Avis de bulletins non envoyés :", e)));
  refresh();
  return { succes: `${data} bulletin(s) publié(s) : les salariés peuvent les consulter. Les avis WhatsApp partent maintenant.` };
}

function resumeBilan(b: BilanAvis): string {
  const morceaux = [`${b.envoyes} avis envoyé(s)`];
  if (b.echecs) morceaux.push(`${b.echecs} échec(s)`);
  if (b.sansNumero) morceaux.push(`${b.sansNumero} salarié(s) sans téléphone`);
  if (b.sansAccord) morceaux.push(`${b.sansAccord} sans accord WhatsApp`);
  if (b.dejaPrevenus) morceaux.push(`${b.dejaPrevenus} déjà prévenu(s)`);
  return `${morceaux.join(", ")}.`;
}

// Renvoi des avis aux salariés pas encore prévenus (nouveau numéro, accord donné, échec).
// Réservé à ceux qui peuvent publier la paie de l'entreprise.
export async function renvoyerAvis(entrepriseId: string, periodeId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const [{ data: autorise }, { data: periode }] = await Promise.all([
    supabase.rpc("peut_publier", { p_entreprise_id: entrepriseId }),
    supabase.from("periodes_paie").select("statut").eq("id", periodeId).eq("entreprise_id", entrepriseId).maybeSingle(),
  ]);
  if (autorise !== true || !periode) return { erreur: "Vous ne pouvez pas envoyer les avis de cette paie." };
  if (periode.statut !== "publiee") return { erreur: "Les avis partent seulement une fois la paie publiée." };
  const bilan = await envoyerAvisBulletins(periodeId);
  refresh();
  return { succes: resumeBilan(bilan) };
}
