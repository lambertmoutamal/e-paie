// Import des résultats de paie depuis l'Excel du logiciel de paie (fonctions pures, testées).
// Les colonnes sont reconnues d'après leur titre ; l'utilisateur peut corriger la
// correspondance. Toute autre colonne chiffrée est conservée comme « rubrique ».

import { z } from "zod";

export const CHAMPS_RESULTAT = [
  { cle: "jours_travailles", libelle: "Jours travaillés", synonymes: ["jours travailles", "nb jours", "jours", "jours payes"] },
  { cle: "salaire_base", libelle: "Salaire de base", synonymes: ["salaire de base", "salaire base", "sal base", "base"] },
  { cle: "heures_sup", libelle: "Heures supplémentaires", synonymes: ["heures supplementaires", "heures sup", "hs", "montant hs"] },
  { cle: "primes", libelle: "Primes et indemnités", synonymes: ["primes", "total primes", "indemnites", "primes et indemnites"] },
  { cle: "avantages_nature", libelle: "Avantages en nature", synonymes: ["avantages en nature", "avantages nature", "aen"] },
  { cle: "brut", libelle: "Salaire brut", synonymes: ["brut", "salaire brut", "total brut", "brut total"] },
  { cle: "brut_imposable", libelle: "Brut imposable", synonymes: ["brut imposable", "imposable", "salaire imposable", "base imposable"] },
  { cle: "cnss_salarie", libelle: "CNSS (part salarié)", synonymes: ["cnss", "cnss salarie", "cnss sal", "cotisation cnss", "retenue cnss"] },
  { cle: "cnamgs_salarie", libelle: "CNAMGS (part salarié)", synonymes: ["cnamgs", "cnamgs salarie", "cnamgs sal", "retenue cnamgs"] },
  { cle: "impot_revenu", libelle: "IRPP / ITS retenu", synonymes: ["irpp", "its", "impot", "impot sur le revenu", "irpp retenu"] },
  { cle: "autres_retenues", libelle: "Autres retenues", synonymes: ["autres retenues", "retenues diverses", "avances", "acomptes", "pret"] },
  { cle: "net_a_payer", libelle: "Net à payer", synonymes: ["net a payer", "net", "net paye", "salaire net", "net a verser"] },
  { cle: "cnss_employeur", libelle: "CNSS (part employeur)", synonymes: ["cnss employeur", "cnss patronale", "cnss pat", "cnss emp"] },
  { cle: "cnamgs_employeur", libelle: "CNAMGS (part employeur)", synonymes: ["cnamgs employeur", "cnamgs patronale", "cnamgs pat", "cnamgs emp"] },
  { cle: "autres_charges_employeur", libelle: "Autres charges patronales", synonymes: ["charges patronales", "autres charges", "tcs", "fnh", "cfp", "taxes patronales"] },
] as const;
export type CleResultat = (typeof CHAMPS_RESULTAT)[number]["cle"];
export type Cible = CleResultat | "matricule" | "rubrique" | "ignorer";

const SYNONYMES_MATRICULE = ["matricule", "mat", "code salarie", "n salarie", "no salarie", "numero salarie", "id salarie", "code"];
const SYNONYMES_IGNORES = ["nom", "prenom", "prenoms", "nom et prenoms", "nom prenoms", "salarie", "poste", "fonction", "emploi", "categorie", "service", "date", "periode", "mois"];

// « N° Salarié » → « n salarie »
export function normaliserEntete(valeur: unknown): string {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[°º.:()/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Correspondance proposée pour un titre de colonne
export function deviner(entete: unknown): Cible {
  const t = normaliserEntete(entete);
  if (!t) return "ignorer";
  if (SYNONYMES_MATRICULE.includes(t)) return "matricule";
  // Les synonymes les plus longs d'abord : « cnss employeur » avant « cnss »
  const candidats = CHAMPS_RESULTAT.flatMap((c) => c.synonymes.map((s) => ({ cle: c.cle, s }))).sort((a, b) => b.s.length - a.s.length);
  const exact = candidats.find((c) => c.s === t);
  if (exact) return exact.cle;
  const contenu = candidats.find((c) => c.s.length >= 4 && t.includes(c.s));
  if (contenu) return contenu.cle;
  if (SYNONYMES_IGNORES.includes(t)) return "ignorer";
  return "rubrique";
}

// Ligne de titres : la première (parmi les 10 premières) qui contient une colonne « matricule »
export function trouverEntetes(feuille: unknown[][]): number {
  for (let i = 0; i < Math.min(10, feuille.length); i++) {
    if ((feuille[i] ?? []).some((c) => deviner(c) === "matricule")) return i;
  }
  return -1;
}

// Montant écrit à la française ou en nombre Excel : 350000, « 350 000 », « 1 234,50 », « 1.234,50 »
export function lireMontant(valeur: unknown): number | null | "invalide" {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : "invalide";
  let t = String(valeur).replace(/[\s  ]/g, "").replace(/(fcfa|xaf|f)$/i, "");
  if (!t || t === "-") return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/[.,](?=\d{3}(\D|$))/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : "invalide";
}

export type LigneAnalysee = {
  numero: number; // numéro de ligne dans Excel
  matricule: string;
  salarieId: string | null;
  champs: Partial<Record<CleResultat, number>>;
  rubriques: Record<string, number>;
  erreurs: string[];
};

export function analyserResultats(
  feuille: unknown[][],
  ligneEntetes: number,
  correspondance: Cible[],
  salaries: { id: string; matricule: string }[],
): LigneAnalysee[] {
  const entetes = feuille[ligneEntetes] ?? [];
  const colMatricule = correspondance.indexOf("matricule");
  const parMatricule = new Map(salaries.map((s) => [s.matricule.trim().toLowerCase(), s.id]));
  const vus = new Map<string, number>();
  const lignes: LigneAnalysee[] = [];

  for (let i = ligneEntetes + 1; i < feuille.length; i++) {
    const ligne = feuille[i] ?? [];
    if (ligne.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    const matricule = colMatricule >= 0 ? String(ligne[colMatricule] ?? "").trim() : "";
    // Lignes de total ou sans matricule : ignorées
    if (!matricule || /^total/i.test(matricule)) continue;

    const resultat: LigneAnalysee = { numero: i + 1, matricule, salarieId: null, champs: {}, rubriques: {}, erreurs: [] };
    correspondance.forEach((cible, c) => {
      if (cible === "matricule" || cible === "ignorer") return;
      const montant = lireMontant(ligne[c]);
      if (montant === "invalide") {
        resultat.erreurs.push(`« ${String(entetes[c] ?? `colonne ${c + 1}`)} » : montant illisible (${String(ligne[c])}).`);
        return;
      }
      if (montant === null) return;
      if (cible === "rubrique") resultat.rubriques[String(entetes[c] ?? `Colonne ${c + 1}`).trim().slice(0, 80)] = montant;
      else resultat.champs[cible] = montant;
    });

    resultat.salarieId = parMatricule.get(matricule.toLowerCase()) ?? null;
    if (!resultat.salarieId) resultat.erreurs.push(`Matricule « ${matricule} » inconnu dans cette entreprise.`);
    const precedente = vus.get(matricule.toLowerCase());
    if (precedente) resultat.erreurs.push(`Matricule déjà présent ligne ${precedente}.`);
    else vus.set(matricule.toLowerCase(), i + 1);
    lignes.push(resultat);
  }
  return lignes;
}

// Données envoyées au serveur (revérifiées)
const montant = z.number().finite().min(-1e12).max(1e12);
export const schemaLigneResultat = z.object({
  salarie_id: z.string().uuid(),
  champs: z.partialRecord(z.enum(CHAMPS_RESULTAT.map((c) => c.cle) as [CleResultat, ...CleResultat[]]), montant),
  rubriques: z.record(z.string().min(1).max(80), montant).refine((r) => Object.keys(r).length <= 60, "Trop de rubriques."),
});
export const schemaImportResultats = z.array(schemaLigneResultat).min(1, "Aucune ligne à importer.").max(3000, "3 000 lignes maximum par import.");
