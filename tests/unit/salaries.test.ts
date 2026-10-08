import { describe, expect, test } from "vitest";
import {
  analyserFeuille,
  colonnePourEntete,
  COLONNES_IMPORT,
  normaliserDate,
  normaliserTelephoneSalarie,
  schemaSalarie,
} from "@/lib/salaries/regles";

const ENTETES = COLONNES_IMPORT.map((c) => c.libelle);
const ligne = (valeurs: Record<string, unknown>) => COLONNES_IMPORT.map((c) => valeurs[c.cle] ?? null);

describe("dates", () => {
  test("accepte JJ/MM/AAAA, JJ-MM-AAAA, AAAA-MM-JJ et les dates Excel", () => {
    expect(normaliserDate("01/03/2022")).toBe("2022-03-01");
    expect(normaliserDate("1-3-2022")).toBe("2022-03-01");
    expect(normaliserDate("2022-03-01")).toBe("2022-03-01");
    expect(normaliserDate(new Date(Date.UTC(2022, 2, 1)))).toBe("2022-03-01");
  });

  test("refuse les dates impossibles ou mal écrites", () => {
    expect(normaliserDate("31/02/2022")).toBeNull();
    expect(normaliserDate("2022/13/01")).toBeNull();
    expect(normaliserDate("hier")).toBeNull();
    expect(normaliserDate("")).toBeNull();
  });
});

describe("téléphone", () => {
  test("complète un numéro local avec l'indicatif par défaut", () => {
    expect(normaliserTelephoneSalarie("77 12 34 56", "+241")).toBe("+24177123456");
    expect(normaliserTelephoneSalarie("+237 677 00 11 22", "+241")).toBe("+237677001122");
  });
});

describe("en-têtes du fichier Excel", () => {
  test("reconnaît les en-têtes sans tenir compte des accents, majuscules et synonymes", () => {
    expect(colonnePourEntete("PRÉNOMS")).toBe("prenoms");
    expect(colonnePourEntete("Date d'embauche")).toBe("date_embauche");
    expect(colonnePourEntete("RIB")).toBe("numero_compte");
    expect(colonnePourEntete("Tél")).toBe("telephone");
    expect(colonnePourEntete("Couleur préférée")).toBeNull();
  });
});

describe("analyse d'une feuille", () => {
  test("ligne correcte : données nettoyées (nom en majuscules, dates et téléphone normalisés)", () => {
    const analyse = analyserFeuille([
      ENTETES,
      ligne({ matricule: "0123", nom: "Ndong", prenoms: "Awa", date_embauche: "01/03/2022", telephone: "77 12 34 56" }),
    ]);
    expect(analyse.colonnesManquantes).toEqual([]);
    expect(analyse.lignes).toHaveLength(1);
    expect(analyse.lignes[0].erreurs).toEqual([]);
    expect(analyse.lignes[0].donnees).toMatchObject({
      matricule: "0123",
      nom: "NDONG",
      date_embauche: "2022-03-01",
      telephone: "+24177123456",
    });
  });

  test("signale les colonnes obligatoires manquantes", () => {
    const analyse = analyserFeuille([["Matricule", "Nom"], ["1", "A"]]);
    expect(analyse.colonnesManquantes).toEqual(["Prénoms", "Date d'embauche"]);
  });

  test("signale chaque erreur avec le numéro de ligne Excel", () => {
    const analyse = analyserFeuille([
      ENTETES,
      ligne({ matricule: "1", nom: "A", prenoms: "B", date_embauche: "01/01/2020" }),
      ligne({ matricule: "", nom: "C", prenoms: "D", date_embauche: "32/01/2020", sexe: "X" }),
    ]);
    expect(analyse.lignes[1].numero).toBe(3);
    expect(analyse.lignes[1].donnees).toBeNull();
    expect(analyse.lignes[1].erreurs).toEqual(
      expect.arrayContaining(["Le matricule est obligatoire.", "Sexe : indiquez F ou M.", "Date d'embauche obligatoire et valide (JJ/MM/AAAA)."]),
    );
  });

  test("refuse les matricules et téléphones en double dans le fichier", () => {
    const analyse = analyserFeuille([
      ENTETES,
      ligne({ matricule: "7", nom: "A", prenoms: "B", date_embauche: "01/01/2020", telephone: "+24177000001" }),
      ligne({ matricule: "7", nom: "C", prenoms: "D", date_embauche: "01/01/2020" }),
      ligne({ matricule: "8", nom: "E", prenoms: "F", date_embauche: "01/01/2020", telephone: "+24177000001" }),
    ]);
    expect(analyse.lignes[1].erreurs).toEqual(["Matricule 7 déjà présent ligne 2."]);
    expect(analyse.lignes[2].erreurs).toEqual(["Téléphone déjà utilisé ligne 2."]);
  });

  test("ignore les lignes vides et les colonnes inconnues", () => {
    const analyse = analyserFeuille([
      [...ENTETES, "Remarques"],
      ligne({ matricule: "1", nom: "A", prenoms: "B", date_embauche: "01/01/2020" }),
      [null, "", null],
    ]);
    expect(analyse.lignes).toHaveLength(1);
    expect(analyse.colonnesIgnorees).toEqual(["Remarques"]);
  });
});

describe("revérification sur le serveur", () => {
  test("des données déjà nettoyées par le navigateur restent valides et identiques", () => {
    const analyse = analyserFeuille([
      ENTETES,
      ligne({ matricule: "9", nom: "Mba", prenoms: "Paul", date_embauche: "15/06/2021", telephone: "77000001", sexe: "m" }),
    ]);
    const nettoyees = analyse.lignes[0].donnees;
    const r = schemaSalarie().safeParse(nettoyees);
    expect(r.success).toBe(true);
    expect(r.success && r.data).toEqual(nettoyees);
  });
});

describe("cohérence des dates", () => {
  test("la naissance doit précéder l'embauche", () => {
    const r = schemaSalarie().safeParse({
      matricule: "1", nom: "A", prenoms: "B", sexe: "", date_naissance: "2030-01-01", nationalite: "", poste: "",
      date_embauche: "2020-01-01", telephone: "", email: "", adresse: "", numero_cnss: "", banque: "", numero_compte: "",
    });
    expect(r.success).toBe(false);
  });
});
