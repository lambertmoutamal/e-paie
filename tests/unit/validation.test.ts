import { describe, expect, test } from "vitest";
import { lireFormulaire } from "@/lib/validation/formulaire";
import {
  schemaCabinet,
  schemaMotDePasse,
  schemaNouvelleAffectation,
  schemaNouvelleEntreprise,
} from "@/lib/validation/schemas";

function formulaire(champs: Record<string, string>) {
  const f = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) f.append(cle, valeur);
  return f;
}

const ENTREPRISE_VALIDE = {
  cabinet_id: "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  raison_sociale: "  Okoumé Services SARL ",
  nif: "",
  rccm: "GA-LBV-2024-B-123",
  numero_cnss: "",
  adresse: "Libreville",
  telephone: "+241 06 12 34 56",
  email: "",
  mode: "cabinet",
};

describe("fiche entreprise", () => {
  test("accepte une fiche valide, nettoie les espaces et remplace les vides par null", () => {
    const lu = lireFormulaire(schemaNouvelleEntreprise, formulaire(ENTREPRISE_VALIDE));
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(lu.donnees.raison_sociale).toBe("Okoumé Services SARL");
    expect(lu.donnees.nif).toBeNull();
    expect(lu.donnees.email).toBeNull();
  });

  test("exige la raison sociale et signale l'erreur sur le bon champ", () => {
    const lu = lireFormulaire(schemaNouvelleEntreprise, formulaire({ ...ENTREPRISE_VALIDE, raison_sociale: "   " }));
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.erreurs.raison_sociale).toBe("La raison sociale est obligatoire.");
    expect(lu.valeurs.rccm).toBe("GA-LBV-2024-B-123"); // la saisie est conservée
  });

  test("refuse un téléphone ou un email mal formés", () => {
    const lu = lireFormulaire(
      schemaNouvelleEntreprise,
      formulaire({ ...ENTREPRISE_VALIDE, telephone: "abc", email: "pas-un-email" }),
    );
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.erreurs.telephone).toContain("téléphone");
    expect(lu.erreurs.email).toBe("L'adresse email n'est pas valide.");
  });

  test("refuse un mode inconnu", () => {
    const lu = lireFormulaire(schemaNouvelleEntreprise, formulaire({ ...ENTREPRISE_VALIDE, mode: "pirate" }));
    expect(lu.ok).toBe(false);
  });
});

describe("cabinet", () => {
  test("exige le nom de l'administrateur si son email est saisi", () => {
    const lu = lireFormulaire(
      schemaCabinet,
      formulaire({ nom: "Cabinet Test", nif: "", telephone: "", email: "", adresse: "", admin_email: "a@b.ga", admin_nom: "" }),
    );
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.erreurs.admin_nom).toBe("Indiquez le nom de l'administrateur.");
  });
});

describe("affectation", () => {
  test("met l'email en minuscules", () => {
    const lu = lireFormulaire(
      schemaNouvelleAffectation,
      formulaire({ email: " Awa.Ndong@Exemple.GA ", nom_complet: "Awa Ndong", role: "rh" }),
    );
    expect(lu.ok && lu.donnees.email).toBe("awa.ndong@exemple.ga");
  });

  test("refuse un rôle qui n'existe pas (ex. tentative de devenir admin)", () => {
    const lu = lireFormulaire(
      schemaNouvelleAffectation,
      formulaire({ email: "a@b.ga", nom_complet: "A B", role: "admin_plateforme" }),
    );
    expect(lu.ok).toBe(false);
  });
});

describe("mot de passe", () => {
  test("exige 10 caractères avec lettres et chiffres", () => {
    const court = lireFormulaire(schemaMotDePasse, formulaire({ mot_de_passe: "abc123", confirmation: "abc123" }));
    const sansChiffre = lireFormulaire(schemaMotDePasse, formulaire({ mot_de_passe: "abcdefghijk", confirmation: "abcdefghijk" }));
    expect(court.ok).toBe(false);
    expect(sansChiffre.ok).toBe(false);
  });

  test("exige que la confirmation soit identique", () => {
    const lu = lireFormulaire(schemaMotDePasse, formulaire({ mot_de_passe: "Libreville2026", confirmation: "Libreville2025" }));
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.erreurs.confirmation).toBe("Les deux mots de passe ne sont pas identiques.");
  });
});
