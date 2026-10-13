// Montant en toutes lettres (reçu pour solde de tout compte), orthographe traditionnelle :
// « quatre-vingts », « deux cents », « mille » invariable, « un million ».

const UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

// 0 à 99 (seul : « quatre-vingts » prend un s en fin de nombre)
function moinsDeCent(n: number, finDeNombre: boolean): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  let u = n % 10;
  if (d === 7 || d === 9) u += 10;
  if (u === 0) return d === 8 && finDeNombre ? "quatre-vingts" : DIZAINES[d];
  const liaison = n % 10 === 1 && d !== 8 && d !== 9 ? " et " : "-";
  return `${DIZAINES[d]}${liaison}${UNITES[u]}`;
}

// 0 à 999
function moinsDeMille(n: number, finDeNombre: boolean): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 0) return moinsDeCent(r, finDeNombre);
  const cent = c === 1 ? "cent" : `${UNITES[c]} cent${r === 0 && finDeNombre ? "s" : ""}`;
  return r === 0 ? cent : `${cent} ${moinsDeCent(r, finDeNombre)}`;
}

export function enLettres(montant: number): string {
  let n = Math.round(Math.abs(montant));
  if (n === 0) return "zéro";
  const morceaux: string[] = [];
  const milliards = Math.floor(n / 1e9);
  n %= 1e9;
  const millions = Math.floor(n / 1e6);
  n %= 1e6;
  const milliers = Math.floor(n / 1000);
  const reste = n % 1000;
  if (milliards) morceaux.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) morceaux.push(`${moinsDeMille(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (milliers) morceaux.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers, false)} mille`);
  if (reste) morceaux.push(moinsDeMille(reste, true));
  return `${montant < 0 ? "moins " : ""}${morceaux.join(" ")}`;
}
