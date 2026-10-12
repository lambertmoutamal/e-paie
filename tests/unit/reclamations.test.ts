import { describe, expect, test } from "vitest";
import { schemaMessageReclamation, schemaNouvelleReclamation } from "@/lib/reclamations/regles";
import { contenuReclamationPersonnel, contenuReponseSalarie } from "@/lib/notifications/messages-reclamations";

const BULLETIN = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("formulaires de réclamation", () => {
  test("nouvelle réclamation : sujet, objet et message obligatoires ; bulletin facultatif", () => {
    expect(schemaNouvelleReclamation.parse({ sujet: "bulletin", objet: " Prime absente ", message: "Il manque ma prime.", bulletin_id: BULLETIN })).toEqual({
      sujet: "bulletin",
      objet: "Prime absente",
      message: "Il manque ma prime.",
      bulletin_id: BULLETIN,
    });
    expect(schemaNouvelleReclamation.parse({ sujet: "autre", objet: "Question", message: "?", bulletin_id: "aucun" }).bulletin_id).toBeNull();
    expect(schemaNouvelleReclamation.safeParse({ sujet: "inconnu", objet: "Question", message: "?" }).success).toBe(false);
    expect(schemaNouvelleReclamation.safeParse({ sujet: "autre", objet: "Q", message: "?" }).success).toBe(false);
    expect(schemaNouvelleReclamation.safeParse({ sujet: "autre", objet: "Question", message: "   " }).success).toBe(false);
  });

  test("réponse : message obligatoire, case « résolue » facultative", () => {
    expect(schemaMessageReclamation.parse({ contenu: "Corrigé.", resoudre: "on" })).toEqual({ contenu: "Corrigé.", resoudre: true });
    expect(schemaMessageReclamation.parse({ contenu: "Nous regardons." })).toEqual({ contenu: "Nous regardons.", resoudre: false });
  });
});

describe("alertes de réclamation", () => {
  test("au personnel : qui, quoi, sujet", () => {
    const c = contenuReclamationPersonnel({ nom: "Marie OBIANG", salarie: "NDONG Awa", entreprise: "SOGEA", sujet: "bulletin", objet: "Prime absente", lien: "https://x" });
    expect(c.sujet).toBe("Réclamation à traiter : Prime absente — NDONG Awa");
    expect(c.whatsapp).toContain("bulletin de paie");
  });

  test("au salarié : réponse ou résolution", () => {
    expect(contenuReponseSalarie({ prenoms: "Awa", entreprise: "SOGEA", objet: "Prime", statut: "en_cours", lien: "https://x" }).sujet).toBe("Réponse à votre réclamation");
    const r = contenuReponseSalarie({ prenoms: "Awa", entreprise: "SOGEA", objet: "Prime", statut: "resolue", lien: "https://x" });
    expect(r.sujet).toBe("Votre réclamation est résolue");
    expect(r.whatsapp).toContain("Confirmez");
  });
});
