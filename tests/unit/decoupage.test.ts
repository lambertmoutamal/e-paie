import { describe, expect, test } from "vitest";
import { libellePages, reconnaitreSalarie, regrouperPages, type Reconnaissance } from "@/lib/bulletins/decoupage";

const salaries = [
  { id: "awa", matricule: "0123", nom: "NDONG", prenoms: "Awa" },
  { id: "paul", matricule: "A-45", nom: "MBA", prenoms: "Paul Henri" },
  { id: "eloi", matricule: "12", nom: "OBAME", prenoms: "Éloi" },
  { id: "rose", matricule: "2026", nom: "NZE", prenoms: "Rose" },
];

const page = (contenu: string) => `BULLETIN DE PAIE Période : octobre 2026 Société EXEMPLE SA ${contenu} Salaire de base 350 000 Net à payer 312 450`;

describe("reconnaissance du salarié sur une page", () => {
  test("lit la valeur écrite après « Matricule », avec ou sans zéros devant", () => {
    expect(reconnaitreSalarie(page("Matricule : 0123 Nom : NDONG Awa"), salaries)).toEqual({ salarieId: "awa", methode: "libelle" });
    expect(reconnaitreSalarie(page("MATRICULE N° 123"), salaries)).toEqual({ salarieId: "awa", methode: "libelle" });
    expect(reconnaitreSalarie(page("Matricule: a-45"), salaries)).toEqual({ salarieId: "paul", methode: "libelle" });
  });

  test("retrouve un matricule écrit sans libellé", () => {
    expect(reconnaitreSalarie("Bulletin de paie Salarié A-45 MBA Paul Henri Net à payer 312 450", salaries)).toEqual({ salarieId: "paul", methode: "recherche" });
    // Avec l'année 2026 (aussi un matricule) sur la page, le nom départage
    expect(reconnaitreSalarie(page("Salarié A-45 MBA Paul Henri"), salaries)).toEqual({ salarieId: "paul", methode: "nom" });
  });

  test("départage par le nom quand plusieurs matricules apparaissent (ex. l'année)", () => {
    // « 2026 » (année) et « 12 » sont tous deux des matricules : le nom tranche
    expect(reconnaitreSalarie(page("Code 12 OBAME Eloi"), salaries)).toEqual({ salarieId: "eloi", methode: "nom" });
  });

  test("signale les pages sans texte, introuvables ou ambiguës", () => {
    expect(reconnaitreSalarie("   ", salaries)).toEqual({ salarieId: null, motif: "aucun_texte" });
    expect(reconnaitreSalarie(page("Matricule : 9999 KOUMBA Jean").replace("2026", "N/A"), salaries)).toEqual({ salarieId: null, motif: "introuvable" });
    expect(reconnaitreSalarie(page("Code 12"), salaries)).toMatchObject({ salarieId: null, motif: "ambigu" });
  });
});

describe("regroupement des pages", () => {
  const ok = (id: string): Reconnaissance => ({ salarieId: id, methode: "libelle" });
  test("pages consécutives du même salarié regroupées, inconnues isolées, doublons signalés", () => {
    const g = regrouperPages([ok("awa"), ok("awa"), ok("paul"), { salarieId: null, motif: "introuvable" }, ok("awa")]);
    expect(g).toEqual([
      { pages: [1, 2], salarieId: "awa" },
      { pages: [3], salarieId: "paul" },
      { pages: [4], salarieId: null, motif: "introuvable" },
      { pages: [5], salarieId: null, motif: "doublon" },
    ]);
    expect(libellePages([1, 2])).toBe("Pages 1 à 2");
  });
});
