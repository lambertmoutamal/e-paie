// @vitest-environment node
import { describe, expect, test } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { reconnaitreSalarie, regrouperPages } from "@/lib/bulletins/decoupage";

const salaries = [
  { id: "awa", matricule: "0123", nom: "NDONG", prenoms: "Awa" },
  { id: "paul", matricule: "A-45", nom: "MBA", prenoms: "Paul" },
];

// Fabrique un lot de bulletins : une ligne de texte par élément, une page par élément du tableau.
async function fabriquerLot(pages: string[][]) {
  const pdf = await PDFDocument.create();
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lignes of pages) {
    const page = pdf.addPage([595, 842]);
    lignes.forEach((texte, i) => page.drawText(texte, { x: 50, y: 780 - i * 20, size: 11, font: police }));
  }
  return pdf.save();
}

async function lireTextes(donnees: Uint8Array) {
  const document = await getDocument({ data: donnees.slice() }).promise;
  const textes: string[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const contenu = await (await document.getPage(n)).getTextContent();
    textes.push(contenu.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return textes;
}

describe("découpage d'un vrai PDF de bulletins", () => {
  test("lit chaque page, reconnaît les salariés et produit un PDF par bulletin", async () => {
    const lot = await fabriquerLot([
      ["BULLETIN DE PAIE - Octobre 2026", "Matricule : 0123", "NDONG Awa", "Net a payer : 312 450"],
      ["BULLETIN DE PAIE - Octobre 2026 (suite)", "Matricule : 0123", "Cumuls annuels"],
      ["BULLETIN DE PAIE - Octobre 2026", "Matricule : A-45", "MBA Paul", "Net a payer : 250 000"],
      ["BULLETIN DE PAIE - Octobre 2026", "Matricule : 7777", "INCONNU Jean"],
    ]);

    const groupes = regrouperPages((await lireTextes(lot)).map((t) => reconnaitreSalarie(t, salaries)));
    expect(groupes).toEqual([
      { pages: [1, 2], salarieId: "awa" },
      { pages: [3], salarieId: "paul" },
      { pages: [4], salarieId: null, motif: "introuvable" },
    ]);

    // Découpage : le bulletin d'Awa contient ses 2 pages, et seulement les siennes
    const source = await PDFDocument.load(lot);
    const bulletin = await PDFDocument.create();
    (await bulletin.copyPages(source, [0, 1])).forEach((p) => bulletin.addPage(p));
    const octets = await bulletin.save();
    const textes = await lireTextes(octets);
    expect(textes).toHaveLength(2);
    expect(textes.join(" ")).toContain("NDONG");
    expect(textes.join(" ")).not.toContain("MBA");
  });
});
