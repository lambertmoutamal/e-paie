// Règles des congés et absences (navigateur et serveur).

import { z } from "zod";

export const NATURES_ABSENCE = {
  conge: "Congé",
  permission: "Permission",
  maladie: "Maladie",
  autre: "Autre absence",
} as const;
export type NatureAbsence = keyof typeof NATURES_ABSENCE;

export const STATUTS_DEMANDE = {
  en_attente: { libelle: "En attente", teinte: "ambre" },
  acceptee: { libelle: "Acceptée", teinte: "vert" },
  refusee: { libelle: "Refusée", teinte: "rouge" },
  annulee: { libelle: "Annulée", teinte: "gris" },
  prevue: { libelle: "Prévu", teinte: "bleu" },
} as const;
export type StatutDemande = keyof typeof STATUTS_DEMANDE;

export const DECOMPTES = {
  ouvrables: "Jours ouvrables (du lundi au samedi)",
  ouvres: "Jours ouvrés (du lundi au vendredi)",
} as const;

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

// « 1 jour », « 4,5 jours »
export function formaterJours(valeur: number | string): string {
  const n = Number(valeur);
  return `${NOMBRE.format(n)} jour${Math.abs(n) > 1 ? "s" : ""}`;
}

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const jour = (date: string) => JOUR.format(new Date(`${date}T00:00:00Z`));

// « du 2 nov. 2026 (après-midi) au 6 nov. 2026 » ou « le 2 nov. 2026 (matin) »
export function libelleDates(p: { debut: string; fin: string; debut_apres_midi?: boolean; fin_midi?: boolean }): string {
  if (p.debut === p.fin) {
    const demi = p.debut_apres_midi ? " (après-midi)" : p.fin_midi ? " (matin)" : "";
    return `le ${jour(p.debut)}${demi}`;
  }
  return `du ${jour(p.debut)}${p.debut_apres_midi ? " (après-midi)" : ""} au ${jour(p.fin)}${p.fin_midi ? " (matin)" : ""}`;
}

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (libelle: string) => z.string().trim().regex(FORMAT_DATE, `${libelle} : choisissez une date.`);
const caseACocher = z.string().optional().transform((v) => v === "on" || v === "true");
const texteFacultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : null));
const identifiant = (message: string) => z.string().uuid(message);

// Demande (portail) ou saisie (RH) : mêmes champs, le RH choisit en plus le salarié.
export const schemaDemande = z
  .object({
    type_id: identifiant("Choisissez le type d'absence."),
    debut: date("Début"),
    fin: date("Fin"),
    debut_apres_midi: caseACocher,
    fin_midi: caseACocher,
    motif: texteFacultatif(500),
  })
  .refine((v) => v.fin >= v.debut, { path: ["fin"], message: "La fin doit être après le début." })
  .refine((v) => !(v.debut === v.fin && v.debut_apres_midi && v.fin_midi), {
    path: ["fin_midi"],
    message: "Sur une seule journée, choisissez soit le matin, soit l'après-midi.",
  });

export const schemaSaisieRh = z.intersection(schemaDemande, z.object({ salarie_id: identifiant("Choisissez le salarié.") }));

// Congé prévisionnel (gestionnaire de paie, RH, administrateur) : journées entières
export const schemaPrevision = z
  .object({
    salarie_id: identifiant("Choisissez le salarié."),
    type_id: identifiant("Choisissez le type d'absence."),
    debut: date("Début"),
    fin: date("Fin"),
    motif: texteFacultatif(500),
  })
  .refine((v) => v.fin >= v.debut, { path: ["fin"], message: "La fin doit être après le début." });

const dateFacultative = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || FORMAT_DATE.test(v), "Date invalide.");

export const schemaSoldeInitial = z
  .object({
    date_reference: date("Date du solde"),
    jours: z
      .string()
      .trim()
      .transform((v) => Number(v.replace(",", ".")))
      .refine((n) => Number.isFinite(n) && n >= -100 && n <= 1000, "Nombre de jours invalide."),
    // Dernier congé pris avant DématPaie (facultatif)
    dernier_conge_debut: dateFacultative,
    dernier_conge_fin: dateFacultative,
  })
  .refine((v) => !v.dernier_conge_fin || (v.dernier_conge_debut !== null && v.dernier_conge_fin >= v.dernier_conge_debut), {
    path: ["dernier_conge_fin"],
    message: "La fin doit être après le début.",
  });

// Nombre saisi en français (« 2,5 ») ; vide → null pour les champs facultatifs
const nombre = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n >= min && n <= max, message);
const nombreFacultatif = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((n) => n === null || (Number.isFinite(n) && n >= min && n <= max), message);

// Acquisition : jours par mois, décompte, jours d'ancienneté
export const schemaParametresConges = z.object({
  jours_par_mois: nombre(0, 5, "Entre 0 et 5 jours par mois."),
  decompte: z.enum(["ouvrables", "ouvres"], "Choisissez le mode de décompte."),
  anciennete_tranche_ans: nombreFacultatif(1, 40, "Entre 1 et 40 ans.").refine((n) => n === null || Number.isInteger(n), "Nombre entier d'années."),
  anciennete_jours_par_tranche: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : 0))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 10, "Entre 0 et 10 jours."),
  anciennete_plafond: nombreFacultatif(0, 100, "Plafond invalide."),
});

// Règles des demandes
export const schemaReglesDemandes = z.object({
  delai_prevenance_jours: nombre(0, 365, "Entre 0 et 365 jours.").refine((n) => Number.isInteger(n), "Nombre entier de jours."),
  solde_negatif_autorise: caseACocher,
  report_max_jours: nombreFacultatif(0, 365, "Nombre de jours invalide."),
  mois_debut_reference: nombre(1, 12, "Choisissez un mois."),
});

export const MODES_VALIDATION = {
  rh: { libelle: "Le RH", aide: "Le RH accepte ou refuse. S'il n'y a pas de RH, les administrateurs s'en chargent." },
  administrateurs: { libelle: "Les administrateurs", aide: "Seuls les administrateurs (cabinet ou entreprise) accepteront ou refuseront." },
  rh_puis_administrateur: {
    libelle: "Le RH, puis un administrateur",
    aide: "Deux validations : le RH donne un premier accord, puis un administrateur (une autre personne) décide.",
  },
} as const;

export const schemaModeValidation = z.object({
  validation_absences: z.enum(["rh", "administrateurs", "rh_puis_administrateur"], "Choisissez qui valide."),
});

export const schemaTypeAbsence = z.object({
  libelle: z.string().trim().min(2, "Nom trop court.").max(80, "80 caractères maximum."),
  nature: z.enum(["conge", "permission", "maladie", "autre"], "Choisissez la nature."),
  jours_max: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((n) => n === null || (Number.isFinite(n) && n > 0 && n <= 365), "Nombre de jours invalide."),
  deduit_solde: caseACocher,
  justificatif_requis: caseACocher,
  demandable: caseACocher,
});

export const schemaJourFerie = z.object({
  jour: date("Date"),
  libelle: z.string().trim().min(2, "Nom trop court.").max(80, "80 caractères maximum."),
});

// Modification d'un type existant (sa nature ne change pas)
export const schemaModifTypeAbsence = schemaTypeAbsence.omit({ nature: true });

