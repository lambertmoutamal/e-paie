// Règles des périodes de paie et du dépôt des bulletins (navigateur et serveur).

import { z } from "zod";

export const NOMS_MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const TAILLE_MAX_BULLETIN = 2 * 1024 * 1024; // 2 Mo

export const STATUTS_PERIODE = {
  brouillon: { libelle: "Brouillon", teinte: "gris" },
  en_validation: { libelle: "En validation", teinte: "ambre" },
  approuvee: { libelle: "Approuvée", teinte: "bleu" },
  publiee: { libelle: "Publiée", teinte: "vert" },
} as const;
export type StatutPeriode = keyof typeof STATUTS_PERIODE;

export function libellePeriode(annee: number, mois: number): string {
  return `${NOMS_MOIS[mois - 1]} ${annee}`;
}

// Années proposées à la création d'une période : les 2 précédentes, l'année en cours et la
// suivante. La liste avance toute seule au 1er janvier.
export function anneesProposees(aujourdhui = new Date()): number[] {
  const annee = aujourdhui.getUTCFullYear();
  return [annee - 2, annee - 1, annee, annee + 1];
}

export const schemaPeriode = z.object({
  periode: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choisissez un mois.")
    .transform((v) => ({ annee: Number(v.slice(0, 4)), mois: Number(v.slice(5, 7)) })),
});

// Premier et dernier jour du mois, au format AAAA-MM-JJ.
export function bornesMois(annee: number, mois: number): { debut: string; fin: string } {
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 0));
  return { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}

type SalariePeriode = { id: string; matricule: string; statut: string; date_embauche: string; date_sortie: string | null };

// Salariés devant recevoir un bulletin pour le mois : embauchés avant la fin du mois
// et pas sortis avant son début.
export function salariesAttendus<T extends SalariePeriode>(salaries: T[], annee: number, mois: number): T[] {
  const { debut, fin } = bornesMois(annee, mois);
  return salaries.filter(
    (s) => s.date_embauche <= fin && (s.statut !== "sorti" || (s.date_sortie !== null && s.date_sortie >= debut)),
  );
}

// Nom de fichier attendu : MATRICULE_AAAA-MM.pdf (la partie période est facultative ;
// MM-AAAA est aussi accepté). Exemple : 0123_2026-10.pdf
export function lireNomFichier(nom: string): { matricule: string; annee: number | null; mois: number | null } | null {
  const sansExtension = nom.trim().replace(/\.pdf$/i, "");
  if (!sansExtension || sansExtension === nom.trim()) return null; // pas un .pdf
  const [matricule, ...reste] = sansExtension.split("_");
  if (!matricule?.trim()) return null;
  const periode = reste.join("_");
  let r = periode.match(/^(\d{4})[-.](\d{1,2})$/);
  if (r) return { matricule: matricule.trim(), annee: Number(r[1]), mois: Number(r[2]) };
  r = periode.match(/^(\d{1,2})[-.](\d{4})$/);
  if (r) return { matricule: matricule.trim(), annee: Number(r[2]), mois: Number(r[1]) };
  return { matricule: matricule.trim(), annee: null, mois: null };
}

export type FichierAssocie = {
  nom: string;
  salarieId: string | null;
  etat: "ok" | "inconnu" | "mauvaise_periode" | "doublon" | "pas_pdf" | "trop_lourd";
  message: string;
};

// Associe chaque fichier déposé en masse au salarié correspondant (par matricule).
export function associerFichiers(
  fichiers: { nom: string; taille: number }[],
  salaries: { id: string; matricule: string; nom: string; prenoms: string }[],
  annee: number,
  mois: number,
): FichierAssocie[] {
  const parMatricule = new Map(salaries.map((s) => [s.matricule.trim().toLowerCase(), s]));
  const dejaVus = new Map<string, string>();

  return fichiers.map(({ nom, taille }): FichierAssocie => {
    const lu = lireNomFichier(nom);
    if (!lu) return { nom, salarieId: null, etat: "pas_pdf", message: "Ce n'est pas un fichier PDF." };
    if (taille > TAILLE_MAX_BULLETIN) return { nom, salarieId: null, etat: "trop_lourd", message: "Fichier trop lourd (2 Mo maximum)." };
    if (lu.annee !== null && (lu.annee !== annee || lu.mois !== mois)) {
      return { nom, salarieId: null, etat: "mauvaise_periode", message: `Le nom indique ${libellePeriode(lu.annee, lu.mois!)}, pas ${libellePeriode(annee, mois)}.` };
    }
    const salarie = parMatricule.get(lu.matricule.toLowerCase());
    if (!salarie) return { nom, salarieId: null, etat: "inconnu", message: `Aucun salarié attendu avec le matricule « ${lu.matricule} ».` };
    const precedent = dejaVus.get(salarie.id);
    if (precedent) return { nom, salarieId: null, etat: "doublon", message: `Même salarié que « ${precedent} ».` };
    dejaVus.set(salarie.id, nom);
    return { nom, salarieId: salarie.id, etat: "ok", message: `${salarie.nom} ${salarie.prenoms}` };
  });
}

// Un vrai PDF commence par « %PDF- » (on ne se fie pas à l'extension du nom).
export function estPdf(debut: Uint8Array): boolean {
  return debut.length >= 5 && debut[0] === 0x25 && debut[1] === 0x50 && debut[2] === 0x44 && debut[3] === 0x46 && debut[4] === 0x2d;
}

// ---------------------------------------------------------------------
// Circuit de validation
// ---------------------------------------------------------------------

export const ROLES_CIRCUIT = {
  controleur: "Contrôleur",
  signataire: "Signataire final",
  rh: "Responsable RH",
  admin_entreprise: "Administrateur de l'entreprise",
  administrateur: "Administrateurs (cabinet ou entreprise)",
} as const;
export type RoleCircuit = keyof typeof ROLES_CIRCUIT;
export type EtapeCircuit = { libelle: string; role: RoleCircuit };

export const MAX_ETAPES = 5;

export const CIRCUIT_PAR_DEFAUT: EtapeCircuit[] = [
  { libelle: "Contrôle", role: "controleur" },
  { libelle: "Approbation", role: "signataire" },
];

const schemaEtape = z.object({
  libelle: z.string().trim().min(2, "Nom trop court.").max(60, "60 caractères maximum."),
  role: z.enum(Object.keys(ROLES_CIRCUIT) as [RoleCircuit, ...RoleCircuit[]], "Choisissez qui valide."),
});

// Lit les étapes envoyées par le formulaire (champs libelle_1, role_1, libelle_2…).
export function lireCircuit(
  formulaire: FormData,
): { ok: true; etapes: EtapeCircuit[] } | { ok: false; erreurs: Record<string, string>; valeurs: Record<string, string> } {
  const valeurs: Record<string, string> = {};
  for (const [cle, valeur] of formulaire.entries()) if (typeof valeur === "string" && !cle.startsWith("$")) valeurs[cle] = valeur;

  const nombre = Number(valeurs.nombre);
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > MAX_ETAPES) {
    return { ok: false, erreurs: { _: `Le circuit doit compter de 1 à ${MAX_ETAPES} étapes.` }, valeurs };
  }
  const etapes: EtapeCircuit[] = [];
  const erreurs: Record<string, string> = {};
  for (let i = 1; i <= nombre; i++) {
    const lu = schemaEtape.safeParse({ libelle: valeurs[`libelle_${i}`] ?? "", role: valeurs[`role_${i}`] ?? "" });
    if (lu.success) etapes.push(lu.data);
    else for (const p of lu.error.issues) erreurs[`${String(p.path[0])}_${i}`] ??= p.message;
  }
  return Object.keys(erreurs).length ? { ok: false, erreurs, valeurs } : { ok: true, etapes };
}

export function libelleRole(role: string): string {
  return ROLES_CIRCUIT[role as RoleCircuit] ?? role;
}
