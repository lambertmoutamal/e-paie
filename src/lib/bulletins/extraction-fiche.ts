// Lecture des informations d'un salarié sur son bulletin de paie (texte extrait du PDF),
// pour créer automatiquement les salariés absents lors d'un dépôt en masse.
// Principe : on repère les libellés (« Nom et prénoms », « Matricule », « Date d'embauche »…)
// et on lit la valeur qui suit, jusqu'au libellé suivant. Fonctions pures (testées).

import { normaliserDate, normaliserModePaiement, type ModePaiement } from "@/lib/salaries/regles";

export type FicheLue = {
  matricule: string | null;
  nom: string | null;
  prenoms: string | null;
  sexe: "F" | "M" | null;
  date_naissance: string | null;
  nationalite: string | null;
  poste: string | null;
  localisation: string | null;
  date_embauche: string | null;
  numero_cnss: string | null;
  numero_cnamgs: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  banque: string | null;
  numero_compte: string | null;
  mode_paiement: ModePaiement | null;
  type_contrat: "cdi" | "cdd" | "stage" | "apprentissage" | "temporaire" | null;
  date_fin_contrat: string | null;
  date_sortie: string | null;
};

type Champ = keyof FicheLue | "nom_prenoms" | "_fin";

// Libellés reconnus (texte en majuscules, sans accents ; « ' » pour toutes les apostrophes).
// En cas de chevauchement, le libellé le plus long l'emporte (« MATRICULE CNSS » avant « MATRICULE »).
const N = String.raw`N\s?[°O]\.?\s?`; // « N° », « No », « N° . »
const LIBELLES: [Champ, string][] = [
  ["nom_prenoms", String.raw`NOMS?\s?(?:ET|&|-|/)\s?PRENOMS?|NOM\s+PRENOMS?|NOMS? DU SALARIE|SALARIE|EMPLOYE|AGENT|BENEFICIAIRE|COLLABORATEUR`],
  ["nom", String.raw`NOMS?|NOM DE FAMILLE`],
  ["prenoms", String.raw`PRENOMS?`],
  ["matricule", String.raw`MATRICULE(?:\s?SALARIE)?|MAT\.?|${N}MATRICULE|CODE SALARIE|${N}SALARIE`],
  ["numero_cnss", String.raw`MATRICULE\s?CNSS|${N}(?:D'\s?)?(?:IMMATRICULATION\s)?CNSS|CNSS\s?${N}|NUMERO\s(?:D'\s?)?(?:IMMATRICULATION\s)?CNSS|${N}SECURITE SOCIALE|${N}S\.?S\.?|IMMATRICULATION`],
  ["numero_cnamgs", String.raw`${N}(?:D'\s?)?(?:ASSURE\s|IMMATRICULATION\s)?CNAMGS|CNAMGS\s?${N}|NUMERO\s(?:D'\s?)?(?:ASSURE\s)?CNAMGS|MATRICULE\s?CNAMGS`],
  ["date_embauche", String.raw`DATE\s(?:D'\s?)?EMBAUCHE|DATE\s(?:D'\s?)?ENTREE|EMBAUCHE?\sLE|ENTREE?\sLE|ENTREE|EMBAUCHE|DATE\s(?:DE\s)?DEBUT(?:\sDE\sCONTRAT)?|DEBUT\sDE\sCONTRAT|DATE\s(?:D'\s?)?ANCIENNETE|ANCIENNETE\sDU|ANCIENNETE\sDEPUIS`],
  ["date_naissance", String.raw`DATE\s(?:DE\s)?NAISSANCE|NE\s?\(?E?\)?\sLE|NEE?\sLE|NAISSANCE`],
  ["date_fin_contrat", String.raw`DATE\s(?:DE\s)?FIN(?:\sDE\sCONTRAT)?|FIN\sDE\sCONTRAT|FIN\sCONTRAT|ECHEANCE(?:\sDU)?\sCONTRAT`],
  ["date_sortie", String.raw`DATE\s(?:DE\s)?SORTIE|SORTIE\sLE|DATE\s(?:DE\s|DU\s)?DEPART|DEPART\sLE`],
  ["nationalite", String.raw`NATIONALITE`],
  ["sexe", String.raw`SEXE|GENRE`],
  ["poste", String.raw`EMPLOI|FONCTION|POSTE(?:\sOCCUPE)?|QUALIFICATION|PROFESSION`],
  ["localisation", String.raw`LOCALISATION|LIEU\sDE\sTRAVAIL|LIEU\s(?:D'\s?)?AFFECTATION|AFFECTATION|SITE|AGENCE|LIEU`],
  ["adresse", String.raw`ADRESSE|DOMICILE|B\.?P\.?`],
  ["telephone", String.raw`TELEPHONE|TEL\.?|PORTABLE|MOBILE`],
  ["email", String.raw`E-?MAIL|COURRIEL`],
  ["banque", String.raw`BANQUE|DOMICILIATION(?:\sBANCAIRE)?|ETABLISSEMENT\sBANCAIRE`],
  ["numero_compte", String.raw`${N}(?:DE\s)?COMPTE(?:\sBANCAIRE)?|COMPTE\s?${N}|COMPTE\sBANCAIRE|RIB|IBAN`],
  ["mode_paiement", String.raw`MODE\s(?:DE\s)?(?:PAIEMENT|REGLEMENT)|REGLEMENT\sPAR|PAIEMENT\sPAR|PAYE\sPAR`],
  ["type_contrat", String.raw`TYPE\s(?:DE\s)?CONTRAT|NATURE\s(?:DU\s)?CONTRAT|CONTRAT`],
  // Autres libellés courants d'un bulletin : ils marquent seulement la fin d'une valeur
  [
    "_fin",
    String.raw`CATEGORIE|ECHELON|CLASSE|COEFFICIENT|INDICE|GRADE|SERVICE|DEPARTEMENT|DIRECTION|PERIODE|MOIS|ANCIENNETE|SITUATION(?:\sFAMILIALE)?|ENFANTS?|NOMBRE|NBRE|PARTS?|CONVENTION|HORAIRE|BASE|TAUX|MONTANT|SALAIRE|RUBRIQUES?|DESIGNATION|LIBELLE|GAINS|RETENUES|NET|BRUT|TOTAL|CUMULS?|CONGES?|BULLETIN|EMPLOYEUR|RAISON\sSOCIALE|NIF|RCCM|CODE|STATUT|DATE|DU|AU|PAIE`,
  ],
];
const RE_LIBELLES: [Champ, RegExp][] = LIBELLES.map(([c, m]) => [c, new RegExp(String.raw`(?<![A-Z0-9])(?:${m})(?![A-Z0-9])`, "g")]);

const DATE = /(\d{1,2})\s?[/.-]\s?(\d{1,2})\s?[/.-]\s?(\d{2,4})|(\d{4})-(\d{2})-(\d{2})/;

type Repere = { champ: Champ; debut: number; fin: number };

// Texte sans accents et en majuscules, de même longueur que l'original (pour retrouver
// la valeur avec ses accents et sa casse d'origine).
function simplifier(texte: string): { original: string; simple: string } {
  const original = texte.normalize("NFC").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ");
  let simple = "";
  for (const c of original) {
    const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    simple += (base.length === c.length ? base : c).toUpperCase().slice(0, c.length).padEnd(c.length, " ");
  }
  return { original, simple };
}

function reperer(simple: string): Repere[] {
  const tous: Repere[] = [];
  for (const [champ, re] of RE_LIBELLES) {
    for (const m of simple.matchAll(re)) tous.push({ champ, debut: m.index, fin: m.index + m[0].length });
  }
  // Le plus long d'abord ; un libellé inclus dans un autre déjà retenu est écarté
  tous.sort((a, b) => b.fin - b.debut - (a.fin - a.debut) || a.debut - b.debut);
  const retenus: Repere[] = [];
  for (const r of tous) if (!retenus.some((x) => r.debut < x.fin && x.debut < r.fin)) retenus.push(r);
  return retenus.sort((a, b) => a.debut - b.debut);
}

// Valeur qui suit le libellé : jusqu'au libellé suivant (80 caractères au plus),
// sans les « : », « - » ou « . » de séparation.
function valeurApres(t: { original: string; simple: string }, reperes: Repere[], i: number): string {
  const r = reperes[i];
  const suivant = reperes[i + 1]?.debut ?? t.original.length;
  return t.original
    .slice(r.fin, Math.min(suivant, r.fin + 80))
    .replace(/^[\s:.\-–=/]+/, "")
    .replace(/[\s:.\-–=,;]+$/, "")
    .trim();
}

function premiereDate(v: string): string | null {
  const m = v.match(DATE);
  if (!m) return null;
  if (m[4]) return normaliserDate(`${m[4]}-${m[5]}-${m[6]}`);
  const annee = m[3].length === 2 ? (Number(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`) : m[3];
  return normaliserDate(`${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${annee}`);
}

// Texte libre : mots jusqu'au premier chiffre isolé, au plus `max` mots
function texte(v: string, max: number, chiffres = false): string | null {
  const mots: string[] = [];
  for (const mot of v.split(" ")) {
    if (!mot) continue;
    if (!chiffres && /\d/.test(mot)) break;
    mots.push(mot);
    if (mots.length >= max) break;
  }
  const r = mots.join(" ").trim();
  return r.length >= 2 ? r.slice(0, 120) : null;
}

// « 123 456 789 », « 40001-00010-12345678901-23 » : chiffres, lettres et séparateurs
function numero(v: string): string | null {
  const m = v.match(/^[A-Z0-9][A-Z0-9 \-/.]{2,40}/i);
  if (!m) return null;
  // On s'arrête au premier mot entièrement alphabétique (début d'un autre libellé)
  const gardes: string[] = [];
  for (const [i, mot] of m[0].trim().split(" ").entries()) {
    if (i > 0 && /^[A-Z]{3,}$/i.test(mot)) break;
    gardes.push(mot);
  }
  const r = gardes.join(" ").trim();
  return /\d/.test(r) ? r.slice(0, 40) : null;
}

const estMajuscules = (mot: string) => mot === mot.toUpperCase() && /\p{L}/u.test(mot);
const capitaliser = (mot: string) => mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase();

// « NDONG ONDO Awa Marie » → nom « NDONG ONDO », prénoms « Awa Marie » ;
// tout en majuscules : le premier mot est le nom.
export function separerNomPrenoms(valeur: string): { nom: string; prenoms: string } | null {
  const mots = (texte(valeur, 6) ?? "").split(" ").filter((m) => /\p{L}/u.test(m));
  if (mots.length < 2) return null;
  let n = 0;
  while (n < mots.length && estMajuscules(mots[n])) n++;
  if (n === 0 || n === mots.length) n = 1;
  return {
    nom: mots.slice(0, n).join(" ").toUpperCase(),
    prenoms: mots
      .slice(n)
      .map((m) => (estMajuscules(m) ? m.split("-").map(capitaliser).join("-") : m))
      .join(" "),
  };
}

const TYPES_CONTRAT: [RegExp, NonNullable<FicheLue["type_contrat"]>][] = [
  [/\bCDI\b|INDETERMINE/, "cdi"],
  [/\bCDD\b|DETERMINE/, "cdd"],
  [/STAGE|STAGIAIRE/, "stage"],
  [/APPRENTI/, "apprentissage"],
  [/TEMPORAIRE|INTERIM|JOURNALIER|OCCASIONNEL/, "temporaire"],
];

export function extraireFicheBulletin(texteBrut: string, matriculeConnu?: string): FicheLue {
  const t = simplifier(texteBrut);
  const reperes = reperer(t.simple);
  const fiche: FicheLue = {
    matricule: matriculeConnu ?? null,
    nom: null,
    prenoms: null,
    sexe: null,
    date_naissance: null,
    nationalite: null,
    poste: null,
    localisation: null,
    date_embauche: null,
    numero_cnss: null,
    numero_cnamgs: null,
    telephone: null,
    email: null,
    adresse: null,
    banque: null,
    numero_compte: null,
    mode_paiement: null,
    type_contrat: null,
    date_fin_contrat: null,
    date_sortie: null,
  };

  reperes.forEach((r, i) => {
    const v = valeurApres(t, reperes, i);
    if (!v) return;
    const simple = v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    switch (r.champ) {
      case "matricule":
        fiche.matricule ??= v.match(/^[A-Z0-9][A-Z0-9\-/._]*/i)?.[0].slice(0, 30) ?? null;
        break;
      case "nom_prenoms": {
        const np = separerNomPrenoms(v);
        if (np && !fiche.nom) Object.assign(fiche, np);
        break;
      }
      case "nom":
        fiche.nom ??= texte(v, 4)?.toUpperCase() ?? null;
        break;
      case "prenoms":
        fiche.prenoms ??= texte(v, 4);
        break;
      case "date_embauche":
      case "date_naissance":
      case "date_fin_contrat":
      case "date_sortie":
        fiche[r.champ] ??= premiereDate(v);
        break;
      case "sexe":
        fiche.sexe ??= /^(F|FEM)/.test(simple) ? "F" : /^(M|MAS|H|HOM)/.test(simple) ? "M" : null;
        break;
      case "nationalite":
        fiche.nationalite ??= texte(v, 2);
        break;
      case "poste":
        fiche.poste ??= texte(v, 6);
        break;
      case "localisation":
        fiche.localisation ??= texte(v, 5);
        break;
      case "adresse":
        fiche.adresse ??= texte(v, 10, true);
        break;
      case "banque":
        fiche.banque ??= texte(v, 5);
        break;
      case "numero_cnss":
        fiche.numero_cnss ??= numero(v);
        break;
      case "numero_cnamgs":
        fiche.numero_cnamgs ??= numero(v);
        break;
      case "numero_compte":
        fiche.numero_compte ??= numero(v);
        break;
      case "telephone": {
        const tel = v.match(/^\+?[\d .]{8,20}/)?.[0].trim();
        fiche.telephone ??= tel && tel.replace(/\D/g, "").length >= 8 ? tel : null;
        break;
      }
      case "email":
        fiche.email ??= v.match(/^[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0].toLowerCase() ?? null;
        break;
      case "mode_paiement":
        fiche.mode_paiement ??= normaliserModePaiement(texte(v, 3) ?? "");
        break;
      case "type_contrat":
        fiche.type_contrat ??= TYPES_CONTRAT.find(([re]) => re.test(simple.slice(0, 30)))?.[1] ?? null;
        break;
    }
  });

  // Type de contrat écrit sans libellé (« CDD », « CDI ») ; une date de fin suppose un CDD
  fiche.type_contrat ??= /(?<![A-Z])CDI(?![A-Z])/.test(t.simple) ? "cdi" : /(?<![A-Z])CDD(?![A-Z])/.test(t.simple) ? "cdd" : null;
  if (fiche.date_fin_contrat && !fiche.type_contrat) fiche.type_contrat = "cdd";
  return fiche;
}

// Libellés français des informations trouvées (aperçu avant création)
export const LIBELLES_FICHE: Record<keyof FicheLue, string> = {
  matricule: "Matricule",
  nom: "Nom",
  prenoms: "Prénoms",
  sexe: "Sexe (F/M)",
  date_naissance: "Date de naissance",
  nationalite: "Nationalité",
  poste: "Poste",
  localisation: "Localisation",
  date_embauche: "Date d'embauche",
  numero_cnss: "N° CNSS",
  numero_cnamgs: "N° CNAMGS",
  telephone: "Téléphone",
  email: "Email",
  adresse: "Adresse",
  banque: "Banque",
  numero_compte: "N° de compte",
  mode_paiement: "Mode de paiement",
  type_contrat: "Type de contrat",
  date_fin_contrat: "Date de fin de contrat",
  date_sortie: "Date de sortie",
};
