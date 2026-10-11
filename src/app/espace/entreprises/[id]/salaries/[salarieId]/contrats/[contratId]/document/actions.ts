"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { nettoyerHtml } from "@/lib/contrats/document";
import { genererPdf } from "@/lib/contrats/pdf";
import { preparerContenu } from "@/lib/contrats/redaction";
import { deposerFichier, supprimerFichier } from "@/lib/stockage/fichiers";

// Les PDF produits par e-Paie portent cette mention : ce sont les seuls qu'une nouvelle
// génération peut remplacer (jamais un contrat signé importé).
const SUFFIXE_GENERE = "(e-Paie).pdf";

function message(error: { code?: string; message: string }, defaut: string) {
  if (error.code === "42501" && error.message.includes("document")) return error.message;
  return defaut;
}

// Prépare le texte à partir d'un modèle (ou d'une page blanche)
export async function commencerDocument(contratId: string, modeleId: string | null) {
  const { supabase } = await exigerUtilisateur();
  const contenu = await preparerContenu(supabase, contratId, modeleId);
  if (contenu === null) return;
  await supabase.from("contrats").update({ contenu, modele_id: modeleId }).eq("id", contratId).is("contenu", null);
  refresh();
}

export async function enregistrerDocument(
  entrepriseId: string,
  salarieId: string,
  contratId: string,
  _e: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const contenu = nettoyerHtml(String(formulaire.get("contenu") ?? ""));
  if (contenu.length > 200_000) return { erreur: "Document trop long." };
  const genererLePdf = formulaire.get("decision") === "pdf";

  const { data: contrat } = await supabase
    .from("contrats")
    .select("nature, document_fige, fichier_chemin, fichier_nom, salaries(nom, prenoms)")
    .eq("id", contratId)
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if (!contrat) return { erreur: "Contrat introuvable." };
  if (contrat.document_fige) return { erreur: "Ce document est signé : il ne peut plus être modifié. Rédigez un avenant." };

  const { data: maj, error } = await supabase.from("contrats").update({ contenu }).eq("id", contratId).select("id");
  if (error || !maj?.length) return { erreur: error ? message(error, "Le document n'a pas pu être enregistré.") : "Vous ne pouvez pas modifier ce document." };
  if (!genererLePdf) {
    refresh();
    return { succes: "Document enregistré." };
  }

  // Ne jamais écraser un contrat signé importé
  if (contrat.fichier_chemin && !contrat.fichier_nom?.endsWith(SUFFIXE_GENERE)) {
    return { erreur: "Un contrat signé est déjà joint : le PDF n'a pas été remplacé. Le texte est enregistré." };
  }
  const salarie = (Array.isArray(contrat.salaries) ? contrat.salaries[0] : contrat.salaries) as { nom: string; prenoms: string } | null;
  const titre = `${contrat.nature === "avenant" ? "Avenant" : "Contrat"} - ${salarie?.nom ?? ""} ${salarie?.prenoms ?? ""}`.trim();
  let octets: Buffer;
  try {
    octets = await genererPdf(contenu, titre);
  } catch (e) {
    console.error("Génération du PDF impossible :", e);
    return { erreur: "Le texte est enregistré, mais le PDF n'a pas pu être généré." };
  }
  const fichier = new File([new Uint8Array(octets)], `${titre} ${SUFFIXE_GENERE}`, { type: "application/pdf" });
  const depot = await deposerFichier(supabase, entrepriseId, salarieId, fichier);
  if ("erreur" in depot) return { erreur: `Le texte est enregistré, mais le PDF n'a pas pu être rangé : ${depot.erreur}` };

  const { error: erreurFichier } = await supabase.from("contrats").update({ fichier_chemin: depot.chemin, fichier_nom: depot.nom }).eq("id", contratId);
  if (erreurFichier) {
    await supprimerFichier(supabase, depot.chemin);
    return { erreur: "Le PDF n'a pas pu être rattaché au contrat." };
  }
  if (contrat.fichier_chemin) await supprimerFichier(supabase, contrat.fichier_chemin);
  refresh();
  return { succes: "Document enregistré et PDF généré. Imprimez-le pour signature, puis joignez la version signée." };
}

// Repartir d'un autre modèle : le texte actuel est remplacé (impossible une fois signé)
export async function recommencerDocument(contratId: string) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("contrats").update({ contenu: null, modele_id: null }).eq("id", contratId).eq("document_fige", false);
  refresh();
}

// Version définitive (signée) : le texte ne pourra plus être modifié
export async function figerDocument(contratId: string) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("contrats").update({ document_fige: true }).eq("id", contratId).not("contenu", "is", null);
  refresh();
}
