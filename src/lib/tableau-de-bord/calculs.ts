// Calculs du tableau de bord (fonctions pures, testées) : effectif, mouvements,
// absentéisme, répartitions. Les données viennent de la base, déjà filtrées par droits.


export type SalarieStat = { sexe: string | null; date_embauche: string; date_sortie: string | null; statut: string };
export type AbsenceStat = { debut: string; fin: string; nb_jours: number; type: string };

// Abréviations françaises usuelles (juin et juillet restent distincts)
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const finDeMois = (annee: number, mois0: number) => new Date(Date.UTC(annee, mois0 + 1, 0));
const debutDeMois = (annee: number, mois0: number) => new Date(Date.UTC(annee, mois0, 1));

// Les 12 derniers mois (du plus ancien au mois en cours)
export function douzeDerniersMois(aujourdhui: Date) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth() - 11 + i, 1));
    const annee = d.getUTCFullYear();
    const mois0 = d.getUTCMonth();
    return { annee, mois0, libelle: `${MOIS_COURTS[mois0]} ${String(annee).slice(2)}`, debut: iso(debutDeMois(annee, mois0)), fin: iso(finDeMois(annee, mois0)) };
  });
}

// Présent à une date : embauché avant, pas encore sorti
export function present(s: SalarieStat, date: string) {
  return s.date_embauche <= date && (!s.date_sortie || s.date_sortie >= date);
}

export function evolutionEffectif(salaries: SalarieStat[], aujourdhui: Date) {
  const auj = iso(aujourdhui);
  return douzeDerniersMois(aujourdhui).map((m) => {
    const date = m.fin < auj ? m.fin : auj;
    return {
      mois: m.libelle,
      effectif: salaries.filter((s) => present(s, date)).length,
      entrees: salaries.filter((s) => s.date_embauche >= m.debut && s.date_embauche <= m.fin).length,
      sorties: salaries.filter((s) => s.date_sortie && s.date_sortie >= m.debut && s.date_sortie <= m.fin).length,
    };
  });
}

// Jours ouvrables (lundi à samedi) d'un mois
export function joursOuvrables(annee: number, mois0: number) {
  let n = 0;
  for (let d = debutDeMois(annee, mois0); d <= finDeMois(annee, mois0); d = new Date(d.getTime() + 86_400_000)) {
    if (d.getUTCDay() !== 0) n++;
  }
  return n;
}

// Jours d'absence comptés dans le mois (au prorata si l'absence déborde du mois)
function joursDansMois(a: AbsenceStat, debut: string, fin: string) {
  const total = (Date.parse(a.fin) - Date.parse(a.debut)) / 86_400_000 + 1;
  const d = a.debut > debut ? a.debut : debut;
  const f = a.fin < fin ? a.fin : fin;
  if (d > f) return 0;
  const dedans = (Date.parse(f) - Date.parse(d)) / 86_400_000 + 1;
  return (Number(a.nb_jours) * dedans) / total;
}

export function absencesDuMois(absences: AbsenceStat[], salaries: SalarieStat[], aujourdhui: Date) {
  const annee = aujourdhui.getUTCFullYear();
  const mois0 = aujourdhui.getUTCMonth();
  const debut = iso(debutDeMois(annee, mois0));
  const fin = iso(finDeMois(annee, mois0));
  const parType = new Map<string, number>();
  let total = 0;
  for (const a of absences) {
    const j = joursDansMois(a, debut, fin);
    if (j <= 0) continue;
    total += j;
    parType.set(a.type, (parType.get(a.type) ?? 0) + j);
  }
  const effectif = salaries.filter((s) => present(s, fin < iso(aujourdhui) ? fin : iso(aujourdhui))).length;
  const capacite = effectif * joursOuvrables(annee, mois0);
  return {
    totalJours: Math.round(total * 10) / 10,
    tauxAbsenteisme: capacite ? Math.round((total / capacite) * 1000) / 10 : 0,
    parType: [...parType].map(([type, jours]) => ({ type, jours: Math.round(jours * 10) / 10 })).sort((x, y) => y.jours - x.jours),
  };
}

export function repartitionSexe(salaries: SalarieStat[], aujourdhui: Date) {
  const presents = salaries.filter((s) => present(s, iso(aujourdhui)));
  return [
    { nom: "Femmes", valeur: presents.filter((s) => s.sexe === "F").length },
    { nom: "Hommes", valeur: presents.filter((s) => s.sexe === "M").length },
    { nom: "Non renseigné", valeur: presents.filter((s) => s.sexe !== "F" && s.sexe !== "M").length },
  ].filter((x) => x.valeur > 0);
}

export function compter<T>(liste: T[], cle: (x: T) => string, libelles: Record<string, string> = {}) {
  const m = new Map<string, number>();
  for (const x of liste) m.set(cle(x), (m.get(cle(x)) ?? 0) + 1);
  return [...m].map(([k, valeur]) => ({ nom: libelles[k] ?? k, valeur })).sort((a, b) => b.valeur - a.valeur);
}
