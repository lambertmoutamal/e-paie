// Documents de contrat rédigés dans e-Paie : champs automatiques, nettoyage du texte
// et conversion en PDF. Le texte est conservé en HTML simple (titres, paragraphes,
// gras, italique, souligné, listes, alignement).

import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";
import { formaterMontant, libelleTypeContrat } from "./regles";
import { CHAMPS_DOCUMENT, type CleChamp } from "./champs";

// ---------------------------------------------------------------------
// Champs automatiques {{cle}}
// ---------------------------------------------------------------------
export { CHAMPS_DOCUMENT, type CleChamp } from "./champs";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateLongue = (d: string | null | undefined) => (d ? DATE_LONGUE.format(new Date(`${d.slice(0, 10)}T00:00:00Z`)) : "");

type Source = {
  entreprise: { raison_sociale: string; adresse?: string | null; rccm?: string | null; nif?: string | null; numero_cnss?: string | null };
  salarie: {
    nom: string;
    prenoms: string;
    sexe?: string | null;
    date_naissance?: string | null;
    nationalite?: string | null;
    adresse?: string | null;
    matricule: string;
    numero_cnss?: string | null;
  };
  contrat: {
    type_contrat: string;
    poste?: string | null;
    categorie?: string | null;
    salaire_base?: number | null;
    devise?: string | null;
    heures_hebdo?: number | null;
    lieu_travail?: string | null;
    date_debut: string;
    date_fin_prevue?: string | null;
    fin_periode_essai?: string | null;
    objet?: string | null;
  };
  aujourdhui: string; // AAAA-MM-JJ
};

// Valeurs des champs pour un contrat donné (vide si l'information manque).
export function valeursChamps({ entreprise: e, salarie: s, contrat: c, aujourdhui }: Source): Record<CleChamp, string> {
  return {
    raison_sociale: e.raison_sociale,
    adresse_entreprise: e.adresse ?? "",
    rccm: e.rccm ?? "",
    nif: e.nif ?? "",
    numero_cnss_entreprise: e.numero_cnss ?? "",
    civilite: s.sexe === "F" ? "Madame" : s.sexe === "M" ? "Monsieur" : "Madame / Monsieur",
    nom: s.nom,
    prenoms: s.prenoms,
    date_naissance: dateLongue(s.date_naissance),
    nationalite: s.nationalite ?? "",
    adresse_salarie: s.adresse ?? "",
    matricule: s.matricule,
    numero_cnss_salarie: s.numero_cnss ?? "",
    type_contrat: libelleTypeContrat(c.type_contrat),
    poste: c.poste ?? "",
    categorie: c.categorie ?? "",
    salaire_base: c.salaire_base !== null && c.salaire_base !== undefined ? formaterMontant(c.salaire_base, c.devise ?? "XAF") : "",
    heures_hebdo: c.heures_hebdo ? String(c.heures_hebdo).replace(".", ",") : "",
    lieu_travail: c.lieu_travail ?? "",
    date_debut: dateLongue(c.date_debut),
    date_fin: dateLongue(c.date_fin_prevue),
    fin_periode_essai: dateLongue(c.fin_periode_essai),
    objet_avenant: c.objet ?? "",
    date_du_jour: dateLongue(aujourdhui),
  };
}

const echapper = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Remplace {{cle}} par sa valeur. Une information manquante est signalée « [à compléter : …] ».
export function remplirChamps(html: string, valeurs: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (tout, cle: string) => {
    if (!(cle in valeurs)) return tout;
    const valeur = valeurs[cle];
    if (valeur) return echapper(valeur);
    const libelle = CHAMPS_DOCUMENT.find((c) => c.cle === cle)?.libelle.toLowerCase() ?? cle;
    return `[à compléter : ${echapper(libelle)}]`;
  });
}

// ---------------------------------------------------------------------
// Nettoyage : seules les balises de mise en forme simple sont conservées
// (aucun script, lien, image ni attribut, sauf l'alignement du texte).
// ---------------------------------------------------------------------
const BALISES: Record<string, string> = {
  p: "p", h1: "h1", h2: "h2", h3: "h3", strong: "strong", b: "strong", em: "em", i: "em", u: "u",
  ul: "ul", ol: "ol", li: "li", br: "br", hr: "hr", blockquote: "blockquote",
};
const ALIGNEMENTS = new Set(["left", "center", "right", "justify"]);
const BLOCS_ALIGNABLES = new Set(["p", "h1", "h2", "h3"]);

function nettoyerNoeud(noeud: Node): string {
  if (noeud.nodeType === NodeType.TEXT_NODE) return echapper(noeud.text);
  if (noeud.nodeType !== NodeType.ELEMENT_NODE) return "";
  const el = noeud as HTMLElement;
  const enfants = el.childNodes.map(nettoyerNoeud).join("");
  const balise = BALISES[el.tagName?.toLowerCase() ?? ""];
  if (!balise) return enfants; // balise inconnue : on garde seulement son texte
  if (balise === "br" || balise === "hr") return `<${balise}>`;
  const alignement = /text-align:\s*(left|center|right|justify)/i.exec(el.getAttribute("style") ?? "")?.[1]?.toLowerCase();
  const style = alignement && ALIGNEMENTS.has(alignement) && BLOCS_ALIGNABLES.has(balise) && alignement !== "left" ? ` style="text-align: ${alignement}"` : "";
  return `<${balise}${style}>${enfants}</${balise}>`;
}

export function nettoyerHtml(html: string): string {
  const racine = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  return racine.childNodes.map(nettoyerNoeud).join("").trim();
}

// ---------------------------------------------------------------------
// Conversion en document PDF (format pdfmake)
// ---------------------------------------------------------------------
type Morceau = { text: string | Morceau[]; bold?: boolean; italics?: boolean; decoration?: "underline" };
type Bloc = Record<string, unknown>;

function morceaux(noeud: Node, style: { bold?: boolean; italics?: boolean; souligne?: boolean } = {}): Morceau[] {
  if (noeud.nodeType === NodeType.TEXT_NODE) {
    const texte = noeud.text.replace(/\s+/g, " ").replaceAll("&nbsp;", " ");
    const decode = parse(`<x>${texte}</x>`).text; // entités HTML → caractères
    if (!decode) return [];
    return [{ text: decode, ...(style.bold && { bold: true }), ...(style.italics && { italics: true }), ...(style.souligne && { decoration: "underline" as const }) }];
  }
  if (noeud.nodeType !== NodeType.ELEMENT_NODE) return [];
  const el = noeud as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return [{ text: "\n" }];
  const suite = {
    bold: style.bold || tag === "strong" || tag === "b",
    italics: style.italics || tag === "em" || tag === "i",
    souligne: style.souligne || tag === "u",
  };
  return el.childNodes.flatMap((n) => morceaux(n, suite));
}

function alignement(el: HTMLElement): string | undefined {
  return /text-align:\s*(center|right|justify)/i.exec(el.getAttribute("style") ?? "")?.[1]?.toLowerCase();
}

function blocs(noeuds: Node[]): Bloc[] {
  const resultat: Bloc[] = [];
  for (const noeud of noeuds) {
    if (noeud.nodeType === NodeType.TEXT_NODE) {
      const t = morceaux(noeud);
      if (t.length && t.some((m) => typeof m.text === "string" && m.text.trim())) resultat.push({ text: t, style: "paragraphe" });
      continue;
    }
    if (noeud.nodeType !== NodeType.ELEMENT_NODE) continue;
    const el = noeud as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      resultat.push({ text: morceaux(el), style: tag, alignment: alignement(el) });
    } else if (tag === "p") {
      const t = morceaux(el);
      resultat.push({ text: t.length ? t : " ", style: "paragraphe", alignment: alignement(el) ?? "justify" });
    } else if (tag === "ul" || tag === "ol") {
      const elements = el.childNodes
        .filter((n) => n.nodeType === NodeType.ELEMENT_NODE && (n as HTMLElement).tagName.toLowerCase() === "li")
        .map((li) => {
          const contenu = blocs((li as HTMLElement).childNodes);
          return contenu.length === 1 ? contenu[0] : { stack: contenu };
        });
      resultat.push({ [tag]: elements, style: "liste" });
    } else if (tag === "hr") {
      resultat.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#999999" }], margin: [0, 6, 0, 10] });
    } else if (tag === "blockquote") {
      resultat.push({ stack: blocs(el.childNodes), margin: [20, 0, 0, 8] });
    } else {
      resultat.push(...blocs(el.childNodes));
    }
  }
  return resultat;
}

export function htmlVersPdf(html: string, titre: string) {
  return {
    info: { title: titre, creator: "e-Paie" },
    pageSize: "A4",
    pageMargins: [56, 56, 56, 64],
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25, color: "#1f2933" },
    styles: {
      h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 14] },
      h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
      h3: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
      paragraphe: { margin: [0, 0, 0, 7] },
      liste: { margin: [10, 0, 0, 7] },
    },
    content: blocs(parse(html).childNodes),
    footer: (page: number, total: number) => ({ text: `${titre} — page ${page} / ${total}`, alignment: "center", fontSize: 8, color: "#8a978f", margin: [0, 24, 0, 0] }),
  };
}
