// @vitest-environment node
import { describe, expect, test } from "vitest";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { reconnaitreSalarie, regrouperPages } from "@/lib/bulletins/decoupage";

const salaries = [
  { id: "awa", matricule: "0123", nom: "NDONG", prenoms: "Awa" },
  { id: "paul", matricule: "A-45", nom: "MBA", prenoms: "Paul" },
];

// Fabrique un lot de bulletins : une ligne de texte par élément, une page par élément du tableau.
async function fabriquerLot(pages: string[][], protection?: { userPassword: string; ownerPassword: string }) {
  const pdf = await PDFDocument.create();
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lignes of pages) {
    const page = pdf.addPage([595, 842]);
    lignes.forEach((texte, i) => page.drawText(texte, { x: 50, y: 780 - i * 20, size: 11, font: police }));
  }
  if (protection) pdf.encrypt(protection);
  return pdf.save();
}

async function lireTextes(donnees: Uint8Array, password?: string) {
  const document = await getDocument({ data: donnees.slice(), password }).promise;
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
    // Une page = un bulletin : la 2e page d'Awa n'est pas ajoutée à son bulletin, elle est signalée
    expect(groupes).toEqual([
      { pages: [1], salarieId: "awa" },
      { pages: [2], salarieId: null, motif: "doublon" },
      { pages: [3], salarieId: "paul" },
      { pages: [4], salarieId: null, motif: "introuvable" },
    ]);

    // Découpage : le bulletin de Paul contient sa seule page, rien d'autre
    const source = await PDFDocument.load(lot);
    const bulletin = await PDFDocument.create();
    (await bulletin.copyPages(source, [2])).forEach((p) => bulletin.addPage(p));
    const octets = await bulletin.save();
    expect((await PDFDocument.load(octets)).getPageCount()).toBe(1);
    const textes = await lireTextes(octets);
    expect(textes.join(" ")).toContain("MBA");
    expect(textes.join(" ")).not.toContain("NDONG");
  });

  test("comptage des pages (contrôle du serveur), y compris d'un PDF protégé", async () => {
    const unePage = await fabriquerLot([["Matricule : 0123"]]);
    const deuxPages = await fabriquerLot([["Matricule : 0123"], ["Matricule : A-45"]], { userPassword: "", ownerPassword: "proprio" });
    const compter = async (o: Uint8Array) => (await PDFDocument.load(o, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
    expect(await compter(unePage)).toBe(1);
    expect(await compter(deuxPages)).toBe(2);
  });

  test("PDF protégé par le logiciel de paie : lu et découpé, mot de passe d'ouverture géré", async () => {
    const pages = [["Matricule : 0123 NDONG Awa"], ["Matricule : A-45 MBA Paul"]];
    for (const userPassword of ["", "ouvrir"]) {
      const lot = await fabriquerLot(pages, { userPassword, ownerPassword: "proprietaire" });
      if (userPassword) await expect(lireTextes(lot)).rejects.toMatchObject({ name: "PasswordException" });
      const textes = await lireTextes(lot, userPassword || undefined);
      expect(textes.map((t) => reconnaitreSalarie(`Bulletin de paie octobre ${t}`, salaries).salarieId)).toEqual(["awa", "paul"]);

      const source = await PDFDocument.load(lot, { password: userPassword });
      const bulletin = await PDFDocument.create();
      (await bulletin.copyPages(source, [1])).forEach((p) => bulletin.addPage(p));
      const decoupe = await bulletin.save();
      expect(await lireTextes(decoupe)).toEqual(["Matricule : A-45 MBA Paul"]);
    }
  });
});
