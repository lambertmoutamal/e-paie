"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { MAX_LIGNES_IMPORT, normaliserDate, schemaSalarie, type Salarie } from "@/lib/salaries/regles";

// Toutes les écritures passent par le client de la personne connectée :
// la base vérifie elle-même le rôle (gestionnaire de paie, RH, admin) et l'abonnement.

function messageErreurBase(code?: string, details?: string): string {
  if (code === "23505") {
    return details?.includes("telephone")
      ? "Ce numéro de téléphone est déjà utilisé par un autre salarié de l'entreprise."
      : "Ce matricule existe déjà dans l'entreprise.";
  }
  if (code === "42501") return "Vous n'avez pas le droit de modifier les salariés de cette entreprise.";
  return "L'enregistrement a échoué.";
}

export async function creerSalarie(entrepriseId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaSalarie(), formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase
    .from("salaries")
    .insert({ ...lu.donnees, entreprise_id: entrepriseId })
    .select("id")
    .single();
  if (error || !data) return { erreur: messageErreurBase(error?.code, error?.message + (error?.details ?? "")), valeurs: lu.valeurs };
  redirect(`/espace/entreprises/${entrepriseId}/salaries/${data.id}`);
}

export async function modifierSalarie(
  entrepriseId: string,
  salarieId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaSalarie(), formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase
    .from("salaries")
    .update(lu.donnees)
    .eq("id", salarieId)
    .eq("entreprise_id", entrepriseId)
    .select("id");
  if (error) return { erreur: messageErreurBase(error.code, error.message + (error.details ?? "")), valeurs: lu.valeurs };
  if (!data?.length) return { erreur: messageErreurBase("42501"), valeurs: lu.valeurs };

  refresh();
  return { succes: "Fiche enregistrée." };
}

const schemaSortie = z.object({
  date_sortie: z.string().transform((v, ctx) => {
    const d = normaliserDate(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Indiquez la date de sortie." });
    return d ?? "";
  }),
  motif_sortie: z.string().trim().min(1, { error: "Indiquez le motif (démission, fin de CDD, licenciement…)." }),
});

export async function enregistrerSortie(
  entrepriseId: string,
  salarieId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaSortie, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase
    .from("salaries")
    .update({ statut: "sorti", ...lu.donnees })
    .eq("id", salarieId)
    .eq("entreprise_id", entrepriseId)
    .select("id");
  if (error?.code === "23514") return { erreur: "La date de sortie ne peut pas précéder la date d'embauche.", valeurs: lu.valeurs };
  if (error || !data?.length) return { erreur: messageErreurBase(error?.code ?? "42501"), valeurs: lu.valeurs };

  refresh();
  return { succes: "Sortie enregistrée." };
}

export async function reintegrerSalarie(entrepriseId: string, salarieId: string) {
  const { supabase } = await exigerUtilisateur();
  await supabase
    .from("salaries")
    .update({ statut: "actif", date_sortie: null, motif_sortie: null })
    .eq("id", salarieId)
    .eq("entreprise_id", entrepriseId);
  refresh();
}

export type ResultatImport =
  | { erreur: string; lignesEnErreur?: { numero: number; erreurs: string[] }[] }
  | { crees: number; misAJour: number };

// Import Excel : le navigateur a déjà montré l'aperçu, mais TOUT est revérifié ici.
// Les matricules existants sont mis à jour, les nouveaux sont créés.
export async function importerSalaries(
  entrepriseId: string,
  nomFichier: string,
  lignes: { numero: number; donnees: unknown }[],
  indicatif: string,
): Promise<ResultatImport> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  if (!Array.isArray(lignes) || lignes.length === 0) return { erreur: "Aucune ligne à importer." };
  if (lignes.length > MAX_LIGNES_IMPORT) return { erreur: `Maximum ${MAX_LIGNES_IMPORT} salariés par import.` };

  const { data: autorise } = await supabase.rpc("peut_gerer_salaries", { p_entreprise_id: entrepriseId });
  if (autorise !== true) return { erreur: "Vous n'avez pas le droit d'importer des salariés dans cette entreprise." };

  const schema = schemaSalarie(/^\+\d{1,4}$/.test(indicatif) ? indicatif : "+241");
  const valides: Salarie[] = [];
  const lignesEnErreur: { numero: number; erreurs: string[] }[] = [];
  for (const ligne of lignes) {
    const r = schema.safeParse(ligne.donnees);
    if (r.success) valides.push(r.data);
    else lignesEnErreur.push({ numero: Number(ligne.numero) || 0, erreurs: r.error.issues.map((i) => i.message) });
  }
  const matricules = valides.map((s) => s.matricule);
  if (new Set(matricules).size !== matricules.length) lignesEnErreur.push({ numero: 0, erreurs: ["Matricules en double dans le fichier."] });
  if (lignesEnErreur.length) return { erreur: "Certaines lignes sont invalides : rien n'a été importé.", lignesEnErreur };

  // Téléphones déjà attribués à un AUTRE salarié de l'entreprise
  const { data: existants } = await supabase
    .from("salaries")
    .select("matricule, telephone")
    .eq("entreprise_id", entrepriseId);
  const matriculesExistants = new Set((existants ?? []).map((s) => s.matricule));
  const telephonePris = new Map((existants ?? []).filter((s) => s.telephone).map((s) => [s.telephone as string, s.matricule]));
  const conflits = valides
    .filter((s) => s.telephone && telephonePris.has(s.telephone) && telephonePris.get(s.telephone) !== s.matricule)
    .map((s) => ({
      numero: lignes.find((l) => (l.donnees as Salarie)?.matricule === s.matricule)?.numero ?? 0,
      erreurs: [`Téléphone déjà utilisé par le salarié ${telephonePris.get(s.telephone!)}.`],
    }));
  if (conflits.length) return { erreur: "Certains téléphones sont déjà utilisés : rien n'a été importé.", lignesEnErreur: conflits };

  const { error } = await supabase
    .from("salaries")
    .upsert(
      valides.map((s) => ({ ...s, entreprise_id: entrepriseId })),
      { onConflict: "entreprise_id,matricule" },
    );
  if (error) {
    console.error("Import des salariés impossible :", error);
    return { erreur: messageErreurBase(error.code, error.message + (error.details ?? "")) };
  }

  const crees = valides.filter((s) => !matriculesExistants.has(s.matricule)).length;
  const misAJour = valides.length - crees;
  await supabase.from("imports_salaries").insert({
    entreprise_id: entrepriseId,
    nom_fichier: nomFichier.slice(0, 200),
    nb_lignes: valides.length,
    nb_crees: crees,
    nb_mis_a_jour: misAJour,
    auteur_id: utilisateur.id,
  });

  refresh();
  return { crees, misAJour };
}
