import { describe, expect, test } from "vitest";
import { extraireFicheBulletin, separerNomPrenoms } from "@/lib/bulletins/extraction-fiche";

// Texte tel que pdf.js le restitue : les cellules du bulletin, à la suite, séparées par des espaces.
const BULLETIN_A = `SOGEA GABON BULLETIN DE PAIE Période du 01/10/2026 au 31/10/2026
Matricule : 0457 Nom et prénoms : NDONG ONDO Awa Marie Sexe : Féminin
Date de naissance : 14/02/1990 Nationalité : Gabonaise Emploi : Comptable principal Catégorie : 8
Date d'embauche : 01/03/2022 Type de contrat : CDD Date de fin de contrat : 28/02/2027
N° CNSS : 123 456 789 Localisation : Port-Gentil Mode de paiement : Virement
Banque : BGFIBank N° de compte : 40001 00010 12345678901 23
Salaire de base 173,33 2 019,61 350 000 Net à payer 312 450`;

const BULLETIN_B = `ETS MBA ET FILS Mat. A-12 NOM MOUSSAVOU PRENOMS Jean-Pierre
Né(e) le 03-07-85 Fonction Chauffeur Date d'entrée 15.01.2019 Service Logistique
Mode de règlement Espèces Lieu de travail Libreville Date de sortie 31/10/2026 Brut 250 000`;

describe("Lecture d'une fiche salarié sur le bulletin", () => {
  test("bulletin avec libellés complets", () => {
    expect(extraireFicheBulletin(BULLETIN_A)).toEqual({
      matricule: "0457",
      nom: "NDONG ONDO",
      prenoms: "Awa Marie",
      sexe: "F",
      date_naissance: "1990-02-14",
      nationalite: "Gabonaise",
      poste: "Comptable principal",
      localisation: "Port-Gentil",
      date_embauche: "2022-03-01",
      numero_cnss: "123 456 789",
      telephone: null,
      email: null,
      adresse: null,
      banque: "BGFIBank",
      numero_compte: "40001 00010 12345678901 23",
      mode_paiement: "virement",
      type_contrat: "cdd",
      date_fin_contrat: "2027-02-28",
      date_sortie: null,
    });
  });

  test("libellés abrégés, nom et prénoms séparés, dates à deux chiffres", () => {
    expect(extraireFicheBulletin(BULLETIN_B)).toMatchObject({
      matricule: "A-12",
      nom: "MOUSSAVOU",
      prenoms: "Jean-Pierre",
      date_naissance: "1985-07-03",
      poste: "Chauffeur",
      date_embauche: "2019-01-15",
      mode_paiement: "especes",
      localisation: "Libreville",
      date_sortie: "2026-10-31",
    });
  });

  test("le matricule déjà reconnu est conservé ; texte vide sans erreur", () => {
    expect(extraireFicheBulletin("Matricule 999 Nom et prénoms OBAME Paul", "0999").matricule).toBe("0999");
    expect(extraireFicheBulletin("").nom).toBeNull();
  });

  test("séparation du nom et des prénoms", () => {
    expect(separerNomPrenoms("NDONG ONDO Awa Marie")).toEqual({ nom: "NDONG ONDO", prenoms: "Awa Marie" });
    expect(separerNomPrenoms("OBAME PAUL HENRI")).toEqual({ nom: "OBAME", prenoms: "Paul Henri" });
    expect(separerNomPrenoms("OBAME")).toBeNull();
  });
});
