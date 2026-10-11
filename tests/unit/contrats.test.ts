import { describe, expect, test } from "vitest";
import { lireFormulaire } from "@/lib/validation/formulaire";
import { cheminFichier, schemaAvenant, schemaContrat, verifierFichier } from "@/lib/contrats/regles";

const f = (champs: Record<string, string>) => {
  const d = new FormData();
  for (const [k, v] of Object.entries(champs)) d.append(k, v);
  return d;
};

const CDD = {
  type_contrat: "cdd",
  poste: "Comptable",
  categorie: "",
  salaire_base: "350 000",
  heures_hebdo: "40",
  lieu_travail: "",
  date_debut: "2026-01-01",
  date_fin_prevue: "2026-12-31",
  fin_periode_essai: "2026-02-15",
  statut: "en_cours",
};

describe("contrat", () => {
  test("accepte un CDD complet ; le salaire saisi avec espaces devient un nombre", () => {
    const lu = lireFormulaire(schemaContrat, f(CDD));
    expect(lu.ok).toBe(true);
    expect(lu.ok && lu.donnees.salaire_base).toBe(350000);
  });

  test("un CDD exige une date de fin ; un CDI non", () => {
    const sansFin = lireFormulaire(schemaContrat, f({ ...CDD, date_fin_prevue: "" }));
    expect(sansFin.ok).toBe(false);
    if (!sansFin.ok) expect(sansFin.erreurs.date_fin_prevue).toBe("Un contrat à durée déterminée doit avoir une date de fin.");
    expect(lireFormulaire(schemaContrat, f({ ...CDD, type_contrat: "cdi", date_fin_prevue: "", fin_periode_essai: "" })).ok).toBe(true);
  });

  test("refuse des dates incohérentes", () => {
    const lu = lireFormulaire(schemaContrat, f({ ...CDD, date_fin_prevue: "2025-12-31", fin_periode_essai: "2027-01-01" }));
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.erreurs.date_fin_prevue).toBe("La date de fin doit suivre la date de début.");
  });

  test("refuse un salaire avec décimales ou négatif", () => {
    expect(lireFormulaire(schemaContrat, f({ ...CDD, salaire_base: "-5" })).ok).toBe(false);
    expect(lireFormulaire(schemaContrat, f({ ...CDD, salaire_base: "1500,50" })).ok).toBe(false);
  });
});

describe("avenant", () => {
  test("exige au moins un élément modifié", () => {
    const lu = lireFormulaire(
      schemaAvenant,
      f({ date_debut: "2026-06-01", objet: "Promotion", poste: "", categorie: "", salaire_base: "", heures_hebdo: "", lieu_travail: "" }),
    );
    expect(lu.ok).toBe(false);
  });
});

describe("fichiers", () => {
  test("accepte PDF, JPEG, PNG de 5 Mo maximum", () => {
    expect(verifierFichier({ size: 1000, type: "application/pdf" })).toBeNull();
    expect(verifierFichier({ size: 1000, type: "image/png" })).toBeNull();
    expect(verifierFichier({ size: 6 * 1024 * 1024, type: "application/pdf" })).toBe("Fichier trop lourd (5 Mo maximum).");
    expect(verifierFichier({ size: 1000, type: "application/x-msdownload" })).toBe("Format accepté : PDF, JPEG ou PNG.");
    expect(verifierFichier(null)).toBe("Choisissez un fichier.");
  });

  test("le chemin commence par l'entreprise et neutralise les caractères dangereux", () => {
    const chemin = cheminFichier("ent", "sal", "../Contrat signé (Awa)?.pdf", "id1");
    expect(chemin).toBe("ent/sal/id1-Contrat-signe-Awa-.pdf");
    expect(chemin.split("/")).toHaveLength(3);
  });
});
