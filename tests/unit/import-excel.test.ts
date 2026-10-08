import { describe, expect, test } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { readSheet } from "read-excel-file/node";
import { analyserFeuille, COLONNES_IMPORT } from "@/lib/salaries/regles";

// Test « de bout en bout » : un vrai fichier .xlsx est produit puis relu,
// comme le ferait un utilisateur avec Excel.
describe("fichier Excel réel", () => {
  test("une date saisie comme date Excel et une date saisie comme texte donnent le même résultat", async () => {
    const entetes = COLONNES_IMPORT.map((c) => ({ value: c.libelle }));
    const valeur = (cle: string, v: unknown) => COLONNES_IMPORT.map((c) => (c.cle === cle ? v : null));
    const fusion = (...lignes: unknown[][]) => COLONNES_IMPORT.map((_, i) => lignes.map((l) => l[i]).find((v) => v !== null) ?? null);

    const ligneDateExcel = fusion(
      valeur("matricule", "001"),
      valeur("nom", "Ndong"),
      valeur("prenoms", "Awa"),
      valeur("date_embauche", new Date(Date.UTC(2022, 2, 1))),
    ).map((v) => (v === null ? null : v instanceof Date ? { value: v, type: Date, format: "dd/mm/yyyy" } : { value: v }));
    const ligneDateTexte = fusion(
      valeur("matricule", "002"),
      valeur("nom", "Mba"),
      valeur("prenoms", "Paul"),
      valeur("date_embauche", "01/03/2022"),
    ).map((v) => (v === null ? null : { value: v }));

    const fichier = await writeExcelFile([entetes, ligneDateExcel, ligneDateTexte] as never).toBuffer();
    const feuille = await readSheet(fichier);
    const analyse = analyserFeuille(feuille as unknown[][]);

    expect(analyse.colonnesManquantes).toEqual([]);
    expect(analyse.lignes.map((l) => l.erreurs)).toEqual([[], []]);
    expect(analyse.lignes.map((l) => l.donnees?.date_embauche)).toEqual(["2022-03-01", "2022-03-01"]);
    expect(analyse.lignes[0].donnees?.matricule).toBe("001");
  });
});
