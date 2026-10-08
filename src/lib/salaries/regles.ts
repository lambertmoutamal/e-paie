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
  { cle: "date_embauche", libelle: "Date d'embauche", obligatoire: true, exemple: "01/03/2022" },
  { cle: "telephone", libelle: "Téléphone", obligatoire: false, exemple: "+241 77 12 34 56" },
  { cle: "email", libelle: "Email", obligatoire: false, exemple: "awa.ndong@exemple.ga" },
  { cle: "adresse", libelle: "Adresse", obligatoire: false, exemple: "Quartier Louis, Libreville" },
  { cle: "numero_cnss", libelle: "N° CNSS", obligatoire: false, exemple: "123456789" },
  { cle: "banque", libelle: "Banque", obligatoire: false, exemple: "BGFIBank" },
  { cle: "numero_compte", libelle: "N° de compte (RIB)", obligatoire: false, exemple: "40001 00010 12345678901 23" },
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
  rib: "numero_compte",
  ndecompterib: "numero_compte",
  numerodecompte: "numero_compte",
  compte: "numero_compte",
  fonction: "poste",
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

export function schemaSalarie(indicatif = "+241") {
  return z.preprocess(videsEnChaines, schemaSalarieBrut(indicatif));
}

function schemaSalarieBrut(indicatif: string) {
  return z
    .object({
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
      banque: texteFacultatif,
      numero_compte: texteFacultatif,
    })
    .refine((s) => !s.date_naissance || !s.date_embauche || s.date_naissance < s.date_embauche, {
      error: "La date de naissance doit précéder la date d'embauche.",
      path: ["date_naissance"],
    });
}

export type Salarie = z.output<ReturnType<typeof schemaSalarie>>;

export type LigneAnalysee = {
  numero: number; // numéro de ligne dans Excel (2 = première ligne de données)
  donnees: Salarie | null;
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

  const schema = schemaSalarie(indicatif);
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
