// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { htmlVersPdf, nettoyerHtml, remplirChamps, valeursChamps } from "@/lib/contrats/document";

const source = {
  entreprise: { raison_sociale: "SOGEA & Fils", adresse: "Libreville", rccm: "GA-LBV-2020-B-123" },
  salarie: { nom: "NDONG", prenoms: "Awa", sexe: "F", date_naissance: "1990-03-15", matricule: "0123", nationalite: "gabonaise" },
  contrat: { type_contrat: "cdi", poste: "Comptable", salaire_base: 350000, devise: "XAF", date_debut: "2026-11-01", heures_hebdo: 40 },
  aujourdhui: "2026-10-12",
};

describe("champs automatiques", () => {
  test("remplit les champs connus, signale ceux qui manquent, échappe les valeurs", () => {
    const v = valeursChamps(source);
    expect(v.civilite).toBe("Madame");
    expect(v.date_debut).toBe("1 novembre 2026");
    const html = remplirChamps("<p>{{civilite}} {{prenoms}} {{nom}}, {{poste}} chez {{raison_sociale}}, CNSS {{numero_cnss_salarie}}, {{inconnu}}</p>", v);
    expect(html).toBe("<p>Madame Awa NDONG, Comptable chez SOGEA &amp; Fils, CNSS [à compléter : n° cnss du salarié], {{inconnu}}</p>");
  });
});

describe("nettoyage du texte", () => {
  test("garde la mise en forme simple, retire scripts, liens, images et attributs", () => {
    const sale = `<h1 style="text-align: center" onclick="x()">Titre</h1><script>alert(1)</script><p>Texte <b>gras</b> <a href="javascript:x">lien</a><img src=x onerror=alert(1)></p><ul><li>Un</li></ul>`;
    expect(nettoyerHtml(sale)).toBe('<h1 style="text-align: center">Titre</h1><p>Texte <strong>gras</strong> lien</p><ul><li>Un</li></ul>');
  });
});

describe("génération du PDF", () => {
  test("produit un vrai PDF lisible, avec accents et mise en forme", async () => {
    const html = remplirChamps(
      '<h1 style="text-align: center">CONTRAT DE TRAVAIL</h1><h2>Article 1 — Engagement</h2><p>{{civilite}} <strong>{{prenoms}} {{nom}}</strong> est engagée à compter du {{date_debut}}.</p><ul><li><p>Salaire : {{salaire_base}}</p></li></ul>',
      valeursChamps(source),
    );
    const require = createRequire(import.meta.url);
    const pdfmake = require("pdfmake");
    const polices = path.dirname(require.resolve("pdfmake/fonts/Roboto/Roboto-Regular.ttf"));
    pdfmake.setFonts({ Roboto: { normal: `${polices}/Roboto-Regular.ttf`, bold: `${polices}/Roboto-Medium.ttf`, italics: `${polices}/Roboto-Italic.ttf`, bolditalics: `${polices}/Roboto-MediumItalic.ttf` } });
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(() => true);
    const octets: Buffer = await pdfmake.createPdf(htmlVersPdf(html, "Contrat de NDONG Awa")).getBuffer();
    expect(octets.subarray(0, 5).toString()).toBe("%PDF-");

    const document = await getDocument({ data: new Uint8Array(octets) }).promise;
    const texte = (await (await document.getPage(1)).getTextContent()).items.map((i) => ("str" in i ? i.str : "")).join(" ");
    expect(texte).toContain("CONTRAT DE TRAVAIL");
    expect(texte).toContain("Madame");
    expect(texte).toContain("1 novembre 2026");
    expect(texte.replace(/\s+/g, " ")).toMatch(/350\s000/);
  });
});
