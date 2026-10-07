import { describe, expect, test } from "vitest";
import { libellePhase, messageBandeau } from "@/lib/abonnements/phases";
import { lireFormulaire } from "@/lib/validation/formulaire";
import { schemaFormule, schemaInscription } from "@/lib/validation/schemas";

function formulaire(champs: Record<string, string>) {
  const f = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) f.append(cle, valeur);
  return f;
}

const INSCRIPTION = {
  type: "entreprise",
  formule: "essai",
  nom_structure: "Okoumé Services",
  nom_complet: "Awa Ndong",
  email: "awa@okoume.ga",
  conditions: "on",
};

describe("bandeau d'abonnement", () => {
  const base = { titulaire: "Okoumé", jours_restants: 12, fin_lecture_seule: "2026-12-31T00:00:00Z" };

  test("essai : jours restants, en alerte à 7 jours ou moins", () => {
    expect(messageBandeau({ ...base, phase: "essai" })).toEqual({
      niveau: "info",
      texte: "Okoumé : essai gratuit, 12 jours restants.",
    });
    expect(messageBandeau({ ...base, phase: "essai", jours_restants: 3 })?.niveau).toBe("alerte");
    expect(messageBandeau({ ...base, phase: "essai", jours_restants: 1 })?.texte).toContain("1 jour restant.");
  });

  test("lecture seule : annonce la date du blocage, salariés compris", () => {
    const m = messageBandeau({ ...base, phase: "lecture_seule" });
    expect(m?.niveau).toBe("alerte");
    expect(m?.texte).toContain("31 décembre 2026");
    expect(m?.texte).toContain("salariés compris");
  });

  test("bloqué : message en rouge ; abonnement actif ou géré : pas de bandeau", () => {
    expect(messageBandeau({ ...base, phase: "bloque" })?.niveau).toBe("danger");
    expect(messageBandeau({ ...base, phase: "actif" })).toBeNull();
    expect(messageBandeau({ ...base, phase: "gere" })).toBeNull();
  });

  test("chaque phase a un libellé", () => {
    expect(libellePhase("lecture_seule").libelle).toBe("Lecture seule");
    expect(libellePhase("bloque").teinte).toBe("rouge");
  });
});

describe("formulaire d'inscription", () => {
  test("accepte une inscription complète", () => {
    expect(lireFormulaire(schemaInscription, formulaire(INSCRIPTION)).ok).toBe(true);
  });

  test("exige l'acceptation des conditions d'utilisation", () => {
    const sansConditions: Record<string, string> = { ...INSCRIPTION };
    delete sansConditions.conditions;
    const lu = lireFormulaire(schemaInscription, formulaire(sansConditions));
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.erreurs.conditions).toBe("Vous devez accepter les conditions d'utilisation.");
  });

  test("refuse un type de structure inventé", () => {
    expect(lireFormulaire(schemaInscription, formulaire({ ...INSCRIPTION, type: "admin_plateforme" })).ok).toBe(false);
  });
});

describe("formule", () => {
  test("le prix doit être un nombre entier positif", () => {
    expect(lireFormulaire(schemaFormule, formulaire({ libelle: "Pro", prix_mensuel: "-5", description: "" })).ok).toBe(false);
    expect(lireFormulaire(schemaFormule, formulaire({ libelle: "Pro", prix_mensuel: "12.5", description: "" })).ok).toBe(false);
    const lu = lireFormulaire(schemaFormule, formulaire({ libelle: "Pro", prix_mensuel: "25000", description: "" }));
    expect(lu.ok && lu.donnees.prix_mensuel).toBe(25000);
  });
});
