// Découpage d'un PDF contenant tous les bulletins du mois : reconnaissance du salarié
// sur chaque page, puis regroupement des pages en bulletins individuels.
// Fonctions pures (testées) ; la lecture du PDF se fait dans le navigateur.

export type SalarieReconnaissable = { id: string; matricule: string; nom: string; prenoms: string };

export type Reconnaissance =
  | { salarieId: string; methode: "libelle" | "recherche" | "nom" }
  | { salarieId: null; motif: "aucun_texte" | "introuvable" | "ambigu"; candidats?: string[] };

const SEPARATEURS = /[^A-Z0-9\-/._]+/;

// Majuscules, sans accents, espaces simplifiés.
function normaliserTexte(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

// « 0123 » et « 123 » désignent le même matricule numérique.
function cleMatricule(matricule: string): string {
  const m = normaliserTexte(matricule).replace(/[.\s]+$/, "");
  return /^\d+$/.test(m) ? m.replace(/^0+(?=\d)/, "") : m;
}

const LIBELLE_MATRICULE = /MATRICULE\s*(?:N\s*[°O]\s*\.?\s*)?[:.\-]?\s*([A-Z0-9][A-Z0-9\-/._]*)/g;

export function reconnaitreSalarie(texte: string, salaries: SalarieReconnaissable[]): Reconnaissance {
  const t = normaliserTexte(texte);
  if (t.length < 20) return { salarieId: null, motif: "aucun_texte" };

  const parCle = new Map<string, SalarieReconnaissable[]>();
  for (const s of salaries) {
    const cle = cleMatricule(s.matricule);
    parCle.set(cle, [...(parCle.get(cle) ?? []), s]);
  }

  // 1. Valeur écrite juste après le mot « Matricule »
  for (const r of t.matchAll(LIBELLE_MATRICULE)) {
    const trouves = parCle.get(cleMatricule(r[1]));
    if (trouves?.length === 1) return { salarieId: trouves[0].id, methode: "libelle" };
  }

  // 2. Un matricule connu présent ailleurs sur la page
  const mots = new Set(t.split(SEPARATEURS).filter(Boolean).map(cleMatricule));
  const candidats = salaries.filter((s) => mots.has(cleMatricule(s.matricule)));
  if (candidats.length === 1) return { salarieId: candidats[0].id, methode: "recherche" };

  // 3. Plusieurs matricules possibles (ex. « 12 » et « 2026 ») : on départage par le nom
  if (candidats.length > 1) {
    const avecNom = candidats.filter((s) => t.includes(normaliserTexte(s.nom)) && t.includes(normaliserTexte(s.prenoms).split(" ")[0]));
    if (avecNom.length === 1) return { salarieId: avecNom[0].id, methode: "nom" };
    return { salarieId: null, motif: "ambigu", candidats: candidats.map((s) => s.id) };
  }
  return { salarieId: null, motif: "introuvable" };
}

export type GroupePages = {
  pages: number[]; // numéros de page (à partir de 1)
  salarieId: string | null;
  motif?: "aucun_texte" | "introuvable" | "ambigu" | "doublon";
};

// Pages consécutives du même salarié = un seul bulletin (bulletin sur plusieurs pages).
// Une page non reconnue reste seule, pour être corrigée à la main.
// Un salarié qui réapparaît plus loin dans le lot est signalé comme doublon.
export function regrouperPages(resultats: Reconnaissance[]): GroupePages[] {
  const groupes: GroupePages[] = [];
  resultats.forEach((r, i) => {
    const page = i + 1;
    const dernier = groupes.at(-1);
    if (r.salarieId && dernier?.salarieId === r.salarieId && dernier.motif === undefined) {
      dernier.pages.push(page);
      return;
    }
    groupes.push("motif" in r ? { pages: [page], salarieId: null, motif: r.motif } : { pages: [page], salarieId: r.salarieId });
  });
  const vus = new Set<string>();
  for (const g of groupes) {
    if (!g.salarieId) continue;
    if (vus.has(g.salarieId)) {
      g.motif = "doublon";
      g.salarieId = null;
    } else vus.add(g.salarieId);
  }
  return groupes;
}

export const MOTIFS_DECOUPAGE: Record<NonNullable<GroupePages["motif"]>, string> = {
  aucun_texte: "Page sans texte (PDF scanné ?) : choisissez le salarié.",
  introuvable: "Aucun matricule reconnu : choisissez le salarié.",
  ambigu: "Plusieurs salariés possibles : choisissez le bon.",
  doublon: "Ce salarié a déjà un bulletin plus haut dans le lot.",
};

export function libellePages(pages: number[]): string {
  return pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages[0]} à ${pages.at(-1)}`;
}
