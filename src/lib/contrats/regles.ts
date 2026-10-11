import { z } from "zod";
import { normaliserDate } from "@/lib/salaries/regles";

// Règles des contrats et des documents du salarié (navigateur et serveur).

export const TYPES_CONTRAT = {
  cdi: "CDI",
  cdd: "CDD",
  stage: "Stage",
  apprentissage: "Apprentissage",
  temporaire: "Temporaire",
} as const;
export type TypeContrat = keyof typeof TYPES_CONTRAT;

export const STATUTS_CONTRAT = {
  brouillon: { libelle: "Brouillon", teinte: "gris" },
  en_cours: { libelle: "En cours", teinte: "vert" },
  termine: { libelle: "Terminé", teinte: "gris" },
  rompu: { libelle: "Rompu", teinte: "rouge" },
} as const;

export const CATEGORIES_DOCUMENT = {
  identite: "Pièce d'identité",
  diplome: "Diplôme",
  attestation: "Attestation",
  contrat_signe: "Contrat signé",
  autre: "Autre",
} as const;

export const TAILLE_MAX_FICHIER = 5 * 1024 * 1024; // 5 Mo
export const TYPES_FICHIER_ACCEPTES = ["application/pdf", "image/jpeg", "image/png"] as const;

const MONTANT = new Intl.NumberFormat("fr-FR");
export function formaterMontant(valeur: number | string | null, devise = "XAF") {
  if (valeur === null || valeur === "") return "—";
  return `${MONTANT.format(Number(valeur))} ${devise === "XAF" || devise === "XOF" ? "FCFA" : devise}`;
}

export function libelleTypeContrat(type: string) {
  return TYPES_CONTRAT[type as TypeContrat] ?? type;
}

const texteFacultatif = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const dateFacultative = (message: string) =>
  z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const d = normaliserDate(v);
    if (!d) ctx.addIssue({ code: "custom", message });
    return d;
  });

const dateObligatoire = (message: string) =>
  z.string().transform((v, ctx) => {
    const d = normaliserDate(v);
    if (!d) ctx.addIssue({ code: "custom", message });
    return d ?? "";
  });

const montantFacultatif = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(/[\s .]/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: "Montant invalide (nombre entier, sans décimale)." });
      return null;
    }
    return n;
  });

const heuresFacultatives = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 80) {
      ctx.addIssue({ code: "custom", message: "Heures par semaine : entre 1 et 80." });
      return null;
    }
    return n;
  });

export const schemaContrat = z
  .object({
    type_contrat: z.enum(Object.keys(TYPES_CONTRAT) as [TypeContrat, ...TypeContrat[]], { error: "Choisissez le type de contrat." }),
    poste: z.string().trim().min(1, { error: "Le poste est obligatoire." }),
    categorie: texteFacultatif,
    salaire_base: montantFacultatif,
    heures_hebdo: heuresFacultatives,
    lieu_travail: texteFacultatif,
    date_debut: dateObligatoire("Date de début obligatoire et valide."),
    date_fin_prevue: dateFacultative("Date de fin invalide."),
    fin_periode_essai: dateFacultative("Date de fin de période d'essai invalide."),
    statut: z.enum(["brouillon", "en_cours"], { error: "Statut invalide." }),
  })
  .superRefine((c, ctx) => {
    if (c.type_contrat !== "cdi" && !c.date_fin_prevue) {
      ctx.addIssue({ code: "custom", path: ["date_fin_prevue"], message: "Un contrat à durée déterminée doit avoir une date de fin." });
    }
    if (c.date_fin_prevue && c.date_debut && c.date_fin_prevue < c.date_debut) {
      ctx.addIssue({ code: "custom", path: ["date_fin_prevue"], message: "La date de fin doit suivre la date de début." });
    }
    if (c.fin_periode_essai && c.date_debut && c.fin_periode_essai < c.date_debut) {
      ctx.addIssue({ code: "custom", path: ["fin_periode_essai"], message: "La fin de période d'essai doit suivre la date de début." });
    }
    if (c.fin_periode_essai && c.date_fin_prevue && c.fin_periode_essai > c.date_fin_prevue) {
      ctx.addIssue({ code: "custom", path: ["fin_periode_essai"], message: "La période d'essai ne peut pas dépasser la fin du contrat." });
    }
  });

export type Contrat = z.output<typeof schemaContrat>;

// Avenant : ce qui change, à partir de quand (les champs vides restent inchangés).
export const schemaAvenant = z
  .object({
    date_debut: dateObligatoire("Date d'effet obligatoire et valide."),
    objet: z.string().trim().min(3, { error: "Décrivez l'objet de l'avenant." }),
    poste: texteFacultatif,
    categorie: texteFacultatif,
    salaire_base: montantFacultatif,
    heures_hebdo: heuresFacultatives,
    lieu_travail: texteFacultatif,
  })
  .refine((a) => a.poste || a.categorie || a.salaire_base !== null || a.heures_hebdo !== null || a.lieu_travail, {
    error: "Indiquez au moins un élément modifié (poste, salaire…).",
    path: ["objet"],
  });

export const schemaFinContrat = z.object({
  statut: z.enum(["termine", "rompu"], { error: "Choisissez le type de fin." }),
  date_fin_effective: dateObligatoire("Date de fin obligatoire et valide."),
  motif_fin: z.string().trim().min(2, { error: "Indiquez le motif." }),
});

export const schemaRenouvellement = z
  .object({
    date_debut: dateObligatoire("Date de début obligatoire et valide."),
    date_fin_prevue: dateObligatoire("Date de fin obligatoire et valide."),
    salaire_base: montantFacultatif,
  })
  .refine((r) => !r.date_debut || !r.date_fin_prevue || r.date_fin_prevue >= r.date_debut, {
    error: "La date de fin doit suivre la date de début.",
    path: ["date_fin_prevue"],
  });

export const schemaDocument = z.object({
  categorie: z.enum(Object.keys(CATEGORIES_DOCUMENT) as [keyof typeof CATEGORIES_DOCUMENT, ...(keyof typeof CATEGORIES_DOCUMENT)[]], {
    error: "Choisissez une catégorie.",
  }),
  libelle: z.string().trim().min(2, { error: "Donnez un nom au document." }).max(120),
});

// Vérifie un fichier envoyé (type et taille). Renvoie un message d'erreur ou null.
export function verifierFichier(fichier: { size: number; type: string } | null | undefined): string | null {
  if (!fichier || fichier.size === 0) return "Choisissez un fichier.";
  if (!(TYPES_FICHIER_ACCEPTES as readonly string[]).includes(fichier.type)) return "Format accepté : PDF, JPEG ou PNG.";
  if (fichier.size > TAILLE_MAX_FICHIER) return "Fichier trop lourd (5 Mo maximum).";
  return null;
}

// Chemin de stockage : <entreprise>/<salarié>/<identifiant>-<nom nettoyé>.
// Le premier dossier est l'entreprise : c'est lui que les règles d'accès vérifient.
export function cheminFichier(entrepriseId: string, salarieId: string, nomOriginal: string, identifiant: string): string {
  const propre = nomOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-80);
  return `${entrepriseId}/${salarieId}/${identifiant}-${propre || "fichier"}`;
}

// Modèle de contrat (rédaction dans DématPaie)
export const CATEGORIES_MODELE = { contrat: "Contrat", avenant: "Avenant" } as const;

export const schemaModele = z.object({
  nom: z.string().trim().min(2, "Nom trop court.").max(120, "120 caractères maximum."),
  categorie: z.enum(["contrat", "avenant"], "Choisissez la catégorie."),
  type_contrat: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || v in TYPES_CONTRAT, "Type de contrat invalide."),
  contenu: z.string().max(200_000, "Document trop long."),
});

