import { describe, expect, test } from "vitest";
import { analyserResultats, deviner, lireMontant, schemaImportResultats, trouverEntetes } from "@/lib/paie/import-resultats";

describe("reconnaissance des colonnes", () => {
  test("titres usuels des logiciels de paie", () => {
    expect(deviner("Matricule")).toBe("matricule");
    expect(deviner("N° Salarié")).toBe("matricule");
    expect(deviner("Nom et prénoms")).toBe("ignorer");
    expect(deviner("Salaire de base")).toBe("salaire_base");
    expect(deviner("BRUT")).toBe("brut");
    expect(deviner("Brut imposable")).toBe("brut_imposable");
    expect(deviner("CNSS")).toBe("cnss_salarie");
    expect(deviner("CNSS employeur")).toBe("cnss_employeur");
    expect(deviner("I.R.P.P")).toBe("rubrique"); // sigle à points : à associer à la main
    expect(deviner("IRPP")).toBe("impot_revenu");
    expect(deviner("Net à payer")).toBe("net_a_payer");
    expect(deviner("Prime de transport")).toBe("rubrique");
  });

  test("montants à la française", () => {
    expect(lireMontant(350000)).toBe(350000);
    expect(lireMontant("350 000")).toBe(350000);
    expect(lireMontant("1 234,50")).toBe(1234.5);
    expect(lireMontant("1.234.567")).toBe(1234567);
    expect(lireMontant("12 500 FCFA")).toBe(12500);
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("abc")).toBe("invalide");
  });
});

describe("analyse d'un fichier", () => {
  const feuille = [
    ["SOGEA — Paie d'octobre 2026"],
    ["Matricule", "Nom", "Salaire de base", "Prime de transport", "Brut", "CNSS", "Net à payer"],
    ["0123", "NDONG Awa", 350000, "25 000", 375000, 9375, "320 000"],
    ["0456", "MBA Paul", 250000, "", 250000, 6250, 210000],
    ["9999", "INCONNU", 100000, "", 100000, 2500, 90000],
    ["0123", "NDONG Awa", 1, "", 1, 0, 1],
    ["TOTAL", "", 700001, 25000, 725001, 18125, 620001],
    [],
  ];
  const salaries = [
    { id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", matricule: "0123" },
    { id: "7a2d3b4c-5e6f-4a70-9b8c-0d1e2f3a4b5c", matricule: "0456" },
  ];

  test("titres trouvés, lignes rattachées, inconnus et doublons signalés, total ignoré", () => {
    const entetes = trouverEntetes(feuille);
    expect(entetes).toBe(1);
    const correspondance = feuille[1].map(deviner);
    const lignes = analyserResultats(feuille, entetes, correspondance, salaries);
    expect(lignes.map((l) => l.matricule)).toEqual(["0123", "0456", "9999", "0123"]);
    expect(lignes[0]).toMatchObject({
      numero: 3,
      salarieId: salaries[0].id,
      champs: { salaire_base: 350000, brut: 375000, cnss_salarie: 9375, net_a_payer: 320000 },
      rubriques: { "Prime de transport": 25000 },
      erreurs: [],
    });
    expect(lignes[2].erreurs[0]).toContain("inconnu");
    expect(lignes[3].erreurs).toContain("Matricule déjà présent ligne 3.");
  });

  test("le serveur revérifie les données reçues", () => {
    expect(schemaImportResultats.safeParse([{ salarie_id: salaries[0].id, champs: { brut: 1 }, rubriques: {} }]).success).toBe(true);
    expect(schemaImportResultats.safeParse([{ salarie_id: salaries[0].id, champs: { piege: 1 }, rubriques: {} }]).success).toBe(false);
    expect(schemaImportResultats.safeParse([]).success).toBe(false);
  });
});
