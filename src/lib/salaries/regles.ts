import { z } from "zod";
import { normaliserTelephone } from "@/lib/paiement/regles";

// Règles communes à la saisie manuelle et à l'import Excel d'un salarié.
// Utilisées dans le navigateur (aperçu de l'import) ET sur le serveur (contrôle final).

export const COLONNES_IMPORT = [
  { cle: "matricule", libelle: "Matricule", obligatoire: true, exemple: "0123" },
  { cle: "nom", libelle: "Nom", obligatoire: true, exemple: "NDONG" },
  { cle: "prenoms", libelle: "Prénoms", obligatoire: true, exemple: "Awa Marie" },
  { cle: "sexe", libelle: "Sexe (F/M)", obligatoire: false, exemple: "F" },
  { cle: "date_naissance", libelle: "Date de naissance", obligatoire: false, exemple: "14/02/1990" },
  { cle: "nationalite", libelle: "Nationalité", obligatoire: false, exemple: "Gabonaise" },
  { cle: "poste", libelle: "Poste", obligatoire: false, exemple: "Comptable" },
  { cle: "localisation", libelle: "Localisation", obligatoire: false, exemple: "Port-Gentil" },
  { cle: "date_embauche", libelle: "Date d'embauche", obligatoire: true, exemple: "01/03/2022" },
  { cle: "telephone", libelle: "Téléphone", obligatoire: false, exemple: "+241 77 12 34 56" },
  { cle: "email", libelle: "Email", obligatoire: false, exemple: "awa.ndong@exemple.ga" },
  { cle: "adresse", libelle: "Adresse", obligatoire: false, exemple: "Quartier Louis, Libreville" },
  { cle: "numero_cnss", libelle: "N° CNSS", obligatoire: false, exemple: "123456789" },
  { cle: "numero_cnamgs", libelle: "N° CNAMGS", obligatoire: false, exemple: "1234567890" },
  { cle: "banque", libelle: "Banque", obligatoire: false, exemple: "BGFIBank" },
  { cle: "numero_compte", libelle: "N° de compte (RIB)", obligatoire: false, exemple: "40001 00010 12345678901 23" },
  { cle: "mode_paiement", libelle: "Mode de paiement", obligatoire: false, exemple: "Virement" },
  { cle: "type_contrat", libelle: "Type de contrat", obligatoire: false, exemple: "CDD" },
  { cle: "salaire_base", libelle: "Salaire de base", obligatoire: false, exemple: "350000" },
  { cle: "date_fin_prevue", libelle: "Date de fin de contrat", obligatoire: false, exemple: "28/02/2027" },
  { cle: "fin_periode_essai", libelle: "Fin de période d'essai", obligatoire: false, exemple: "01/06/2022" },
] as const;

export type CleColonne = (typeof COLONNES_IMPORT)[number]["cle"];
export const MAX_LIGNES_IMPORT = 2000;

// Compare des en-têtes sans tenir compte des majuscules, accents, espaces et ponctuation.
export function normaliserEntete(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Synonymes acceptés pour les en-têtes (fichiers préparés à la main)
const SYNONYMES: Record<string, CleColonne> = {
  prenom: "prenoms",
  sexefm: "sexe",
  genre: "sexe",
  datedenaissance: "date_naissance",
  naissance: "date_naissance",
  dateembauche: "date_embauche",
  datedembauche: "date_embauche",
  embauche: "date_embauche",
  tel: "telephone",
  telephone: "telephone",
  mobile: "telephone",
  courriel: "email",
  mail: "email",
  cnss: "numero_cnss",
  ncnss: "numero_cnss",
  numerocnss: "numero_cnss",
  cnamgs: "numero_cnamgs",
  ncnamgs: "numero_cnamgs",
  numerocnamgs: "numero_cnamgs",
  rib: "numero_compte",
  ndecompterib: "numero_compte",
  numerodecompte: "numero_compte",
  compte: "numero_compte",
  fonction: "poste",
  lieudetravail: "localisation",
  lieutravail: "localisation",
  site: "localisation",
  affectation: "localisation",
  modepaiement: "mode_paiement",
  modedepaiement: "mode_paiement",
  modedereglement: "mode_paiement",
  paiement: "mode_paiement",
  contrat: "type_contrat",
  typecontrat: "type_contrat",
  salaire: "salaire_base",
  salairebase: "salaire_base",
  salairedebase: "salaire_base",
  datefin: "date_fin_prevue",
  datefincontrat: "date_fin_prevue",
  findecontrat: "date_fin_prevue",
  finessai: "fin_periode_essai",
  findessai: "fin_periode_essai",
  periodedessai: "fin_periode_essai",
  finperiodeessai: "fin_periode_essai",
};

export function colonnePourEntete(entete: string): CleColonne | null {
  const n = normaliserEntete(entete);
  const directe = COLONNES_IMPORT.find((c) => normaliserEntete(c.libelle) === n || normaliserEntete(c.cle) === n);
  return directe?.cle ?? SYNONYMES[n] ?? null;
}

// Dates : cellule Excel (Date), « JJ/MM/AAAA », « JJ-MM-AAAA » ou « AAAA-MM-JJ ». Renvoie « AAAA-MM-JJ ».
export function normaliserDate(valeur: unknown): string | null {
  if (valeur instanceof Date && !Number.isNaN(valeur.getTime())) {
    // Les dates Excel sont lues en UTC : on garde le jour tel qu'il est saisi.
    return valeur.toISOString().slice(0, 10);
  }
  const texte = String(valeur ?? "").trim();
  let a: number, m: number, j: number;
  let r = texte.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (r) [j, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = texte.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [a, m, j] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  if (a < 1900 || a > 2100) return null;
  return d.toISOString().slice(0, 10);
}

// Téléphone : format international, ou numéro local complété avec l'indicatif par défaut.
export function normaliserTelephoneSalarie(valeur: string, indicatif: string): string | null {
  const brut = valeur.replace(/[\s.\-()]/g, "");
  if (!brut) return null;
  if (brut.startsWith("+") || brut.startsWith("00")) return normaliserTelephone(brut);
  return normaliserTelephone(`${indicatif}${brut}`);
}

// Mode de paiement du salaire : « Virement bancaire », « Espèces », « Airtel Money »…
export const MODES_PAIEMENT = {
  virement: "Virement bancaire",
  especes: "Espèces",
  cheque: "Chèque",
  mobile_money: "Mobile money",
} as const;
export type ModePaiement = keyof typeof MODES_PAIEMENT;

export function normaliserModePaiement(valeur: string): ModePaiement | null {
  const v = normaliserEntete(valeur);
  if (!v) return null;
  if (v.includes("virement") || v.includes("banque") || v.includes("bancaire")) return "virement";
  if (v.includes("espece") || v.includes("cash") || v.includes("caisse")) return "especes";
  if (v.includes("cheque")) return "cheque";
  if (v.includes("mobile") || v.includes("airtel") || v.includes("moov") || v.includes("momo")) return "mobile_money";
  return (Object.keys(MODES_PAIEMENT) as ModePaiement[]).find((m) => normaliserEntete(m) === v) ?? null;
}

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texteFacultatif = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));
const texteObligatoire = (libelle: string) => z.string().trim().min(1, { error: `${libelle} est obligatoire.` });

// Les valeurs absentes (null) sont traitées comme des champs vides : le même schéma
// valide la saisie brute ET des données déjà nettoyées (revérification sur le serveur).
function videsEnChaines(valeur: unknown) {
  if (!valeur || typeof valeur !== "object" || valeur instanceof Date) return valeur;
  return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, v === null || v === undefined ? "" : v]));
}

// Fiche salarié seule (saisie manuelle)
export function schemaSalarie(indicatif = "+241") {
  return z.preprocess(
    videsEnChaines,
    z.object(champsSalarie(indicatif)).refine(naissanceAvantEmbauche, MESSAGE_NAISSANCE),
  );
}

// Ligne d'import Excel : fiche salarié + contrat en cours (facultatif)
export function schemaLigneImport(indicatif = "+241") {
  return z.preprocess(
    videsEnChaines,
    z.object({ ...champsSalarie(indicatif), ...CHAMPS_CONTRAT_IMPORT }).superRefine((l, ctx) => {
      if (!naissanceAvantEmbauche(l)) ctx.addIssue({ code: "custom", ...MESSAGE_NAISSANCE });
      const contratRenseigne = l.salaire_base !== null || l.date_fin_prevue || l.fin_periode_essai;
      if (!l.type_contrat && contratRenseigne) {
        ctx.addIssue({ code: "custom", path: ["type_contrat"], message: "Indiquez le type de contrat (CDI, CDD…)." });
      }
      if (l.type_contrat && l.type_contrat !== "cdi" && !l.date_fin_prevue) {
        ctx.addIssue({ code: "custom", path: ["date_fin_prevue"], message: "Date de fin de contrat obligatoire pour un contrat à durée déterminée." });
      }
      if (l.date_fin_prevue && l.date_embauche && l.date_fin_prevue < l.date_embauche) {
        ctx.addIssue({ code: "custom", path: ["date_fin_prevue"], message: "La fin de contrat doit suivre la date d'embauche." });
      }
      if (l.fin_periode_essai && l.date_embauche && l.fin_periode_essai < l.date_embauche) {
        ctx.addIssue({ code: "custom", path: ["fin_periode_essai"], message: "La fin de période d'essai doit suivre la date d'embauche." });
      }
    }),
  );
}

const MESSAGE_NAISSANCE = { message: "La date de naissance doit précéder la date d'embauche.", path: ["date_naissance"] };
function naissanceAvantEmbauche(s: { date_naissance: string | null; date_embauche: string }) {
  return !s.date_naissance || !s.date_embauche || s.date_naissance < s.date_embauche;
}

const TYPES_CONTRAT_IMPORT = ["cdi", "cdd", "stage", "apprentissage", "temporaire"] as const;

const dateImportFacultative = (message: string) =>
  z.unknown().transform((v, ctx) => {
    if (v === undefined || v === null || String(v).trim() === "") return null;
    const d = normaliserDate(v);
    if (!d) ctx.addIssue({ code: "custom", message });
    return d;
  });

const CHAMPS_CONTRAT_IMPORT = {
  type_contrat: z
    .string()
    .transform((v) => normaliserEntete(v))
    .transform((v, ctx) => {
      if (v === "") return null;
      const type = TYPES_CONTRAT_IMPORT.find((t) => t === v);
      if (!type) ctx.addIssue({ code: "custom", message: "Type de contrat inconnu (CDI, CDD, Stage, Apprentissage ou Temporaire)." });
      return type ?? null;
    }),
  salaire_base: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v.replace(/[\s  ]/g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "Salaire de base invalide (nombre entier, sans décimale)." });
        return null;
      }
      return n;
    }),
  date_fin_prevue: dateImportFacultative("Date de fin de contrat invalide (JJ/MM/AAAA)."),
  fin_periode_essai: dateImportFacultative("Fin de période d'essai invalide (JJ/MM/AAAA)."),
};

function champsSalarie(indicatif: string) {
  return {
      matricule: texteObligatoire("Le matricule").max(30, { error: "Le matricule est trop long (30 caractères maximum)." }),
      nom: texteObligatoire("Le nom").transform((v) => v.toUpperCase()),
      prenoms: texteObligatoire("Les prénoms"),
      sexe: z
        .string()
        .trim()
        .toUpperCase()
        .refine((v) => v === "" || v === "F" || v === "M", { error: "Sexe : indiquez F ou M." })
        .transform((v) => (v === "" ? null : (v as "F" | "M"))),
      date_naissance: z
        .unknown()
        .transform((v, ctx) => {
          if (v === undefined || v === null || String(v).trim() === "") return null;
          const d = normaliserDate(v);
          if (!d) ctx.addIssue({ code: "custom", message: "Date de naissance invalide (JJ/MM/AAAA)." });
          return d;
        }),
      nationalite: texteFacultatif,
      poste: texteFacultatif,
      // Champs ajoutés après coup : absents des anciens fichiers, ils deviennent « null »
      localisation: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : null)),
      date_embauche: z.unknown().transform((v, ctx) => {
        const d = normaliserDate(v);
        if (!d) ctx.addIssue({ code: "custom", message: "Date d'embauche obligatoire et valide (JJ/MM/AAAA)." });
        return d ?? "";
      }),
      telephone: z
        .string()
        .trim()
        .transform((v, ctx) => {
          if (v === "") return null;
          const t = normaliserTelephoneSalarie(v, indicatif);
          if (!t) ctx.addIssue({ code: "custom", message: "Téléphone invalide (exemple : +241 77 12 34 56)." });
          return t;
        }),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .refine((v) => v === "" || FORMAT_EMAIL.test(v), { error: "Email invalide." })
        .transform((v) => (v === "" ? null : v)),
      adresse: texteFacultatif,
      numero_cnss: texteFacultatif,
      numero_cnamgs: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : null)),
      banque: texteFacultatif,
      numero_compte: texteFacultatif,
      mode_paiement: z
        .string()
        .trim()
        .optional()
        .transform((v, ctx) => {
          if (!v) return null;
          const m = normaliserModePaiement(v);
          if (!m) ctx.addIssue({ code: "custom", message: "Mode de paiement inconnu (virement, espèces, chèque ou mobile money)." });
          return m;
        }),
  };
}

export type Salarie = z.output<ReturnType<typeof schemaSalarie>>;
export type LigneImport = z.output<ReturnType<typeof schemaLigneImport>>;

const CLES_CONTRAT = ["type_contrat", "salaire_base", "date_fin_prevue", "fin_periode_essai"] as const;

// Sépare une ligne d'import en fiche salarié et contrat (null si aucun type de contrat).
export function separerLigne(ligne: LigneImport): {
  salarie: Salarie;
  contrat: { type_contrat: (typeof TYPES_CONTRAT_IMPORT)[number]; salaire_base: number | null; date_fin_prevue: string | null; fin_periode_essai: string | null } | null;
} {
  const salarie = Object.fromEntries(Object.entries(ligne).filter(([cle]) => !(CLES_CONTRAT as readonly string[]).includes(cle))) as Salarie;
  const contrat = ligne.type_contrat
    ? { type_contrat: ligne.type_contrat, salaire_base: ligne.salaire_base, date_fin_prevue: ligne.date_fin_prevue, fin_periode_essai: ligne.fin_periode_essai }
    : null;
  return { salarie, contrat };
}

export type LigneAnalysee = {
  numero: number; // numéro de ligne dans Excel (2 = première ligne de données)
  donnees: LigneImport | null;
  erreurs: string[];
};

export type AnalyseImport = {
  colonnesManquantes: string[];
  colonnesIgnorees: string[];
  lignes: LigneAnalysee[];
};

// Analyse le contenu d'une feuille Excel (tableau de lignes ; la première contient les en-têtes).
export function analyserFeuille(feuille: unknown[][], indicatif = "+241"): AnalyseImport {
  const [entetes = [], ...lignesBrutes] = feuille;
  const correspondance = new Map<number, CleColonne>();
  const colonnesIgnorees: string[] = [];
  entetes.forEach((entete, index) => {
    const texte = String(entete ?? "").trim();
    if (!texte) return;
    const cle = colonnePourEntete(texte);
    if (cle && ![...correspondance.values()].includes(cle)) correspondance.set(index, cle);
    else colonnesIgnorees.push(texte);
  });

  const presentes = new Set(correspondance.values());
  const colonnesManquantes = COLONNES_IMPORT.filter((c) => c.obligatoire && !presentes.has(c.cle)).map((c) => c.libelle);
  if (colonnesManquantes.length) return { colonnesManquantes, colonnesIgnorees, lignes: [] };

  const schema = schemaLigneImport(indicatif);
  const matricules = new Map<string, number>();
  const telephones = new Map<string, number>();
  const lignes: LigneAnalysee[] = [];

  lignesBrutes.forEach((cellules, index) => {
    if (!cellules || cellules.every((c) => c === null || c === undefined || String(c).trim() === "")) return;
    const objet: Record<string, unknown> = Object.fromEntries(COLONNES_IMPORT.map((c) => [c.cle, ""]));
    correspondance.forEach((cle, colonne) => {
      const valeur = cellules[colonne];
      objet[cle] = valeur instanceof Date ? valeur : valeur === null || valeur === undefined ? "" : String(valeur);
    });

    const numero = index + 2;
    const resultat = schema.safeParse(objet);
    const erreurs = resultat.success ? [] : resultat.error.issues.map((i) => i.message);
    const donnees = resultat.success ? resultat.data : null;

    if (donnees) {
      const doublon = matricules.get(donnees.matricule);
      if (doublon) erreurs.push(`Matricule ${donnees.matricule} déjà présent ligne ${doublon}.`);
      else matricules.set(donnees.matricule, numero);
      if (donnees.telephone) {
        const tel = telephones.get(donnees.telephone);
        if (tel) erreurs.push(`Téléphone déjà utilisé ligne ${tel}.`);
        else telephones.set(donnees.telephone, numero);
      }
    }
    lignes.push({ numero, donnees: erreurs.length ? null : donnees, erreurs });
  });

  return { colonnesManquantes, colonnesIgnorees, lignes };
}
