import { describe, expect, test } from "vitest";
import { contenuAlerte } from "@/lib/notifications/messages-paie";
import { emailActionPaie } from "@/lib/email/modeles";
import { schemaProfil } from "@/lib/validation/schemas";

const base = {
  nom: "Awa NDONG",
  entreprise: "SOGEA <SA>",
  annee: 2026,
  mois: 10,
  etape: "Contrôle",
  commentaire: null,
  lien: "https://e-paie.example/espace/entreprises/e1/paie/p1",
};

describe("contenu des alertes de paie", () => {
  test("validation : sujet, texte WhatsApp et variables du modèle", () => {
    const c = contenuAlerte({ ...base, motif: "a_valider" });
    expect(c.sujet).toBe("À valider : paie de Octobre 2026 — SOGEA <SA>");
    expect(c.whatsapp).toContain("Bonjour Awa");
    expect(c.whatsapp).toContain("valider l'étape « Contrôle »");
    expect(c.whatsapp.endsWith(base.lien)).toBe(true);
    expect(c.variables).toEqual({ "1": "Awa", "2": "valider l'étape « Contrôle » de la paie de Octobre 2026 (SOGEA <SA>)", "3": base.lien });
  });

  test("refus : le motif est repris dans l'email et le WhatsApp", () => {
    const c = contenuAlerte({ ...base, motif: "a_corriger", commentaire: "Prime oubliée" });
    expect(c.sujet).toContain("Refusée, à corriger");
    expect(c.paragraphes.join(" ")).toContain("« Prime oubliée »");
    expect(c.whatsapp).toContain("« Prime oubliée »");
  });

  test("l'email échappe les données saisies (pas d'injection de code)", () => {
    const email = emailActionPaie(contenuAlerte({ ...base, motif: "a_publier" }), base.lien);
    expect(email.html).toContain("SOGEA &lt;SA&gt;");
    expect(email.html).not.toContain("SOGEA <SA>");
    expect(email.texte).toContain("Publier aux salariés : " + base.lien);
  });
});

describe("étape sans validateur possible", () => {
  test("le message nomme le rôle manquant et ne parle pas de refus", () => {
    const c = contenuAlerte({ ...base, motif: "sans_validateur", etape: "Approbation", commentaire: "signataire" });
    expect(c.sujet).toContain("rôle à attribuer");
    expect(c.paragraphes.join(" ")).toContain("signataire final");
    expect(c.whatsapp).not.toContain("refus");
  });
});

describe("numéro WhatsApp du profil", () => {
  test("facultatif, normalisé au format international, refusé s'il est invalide", () => {
    expect(schemaProfil.parse({ nom_complet: "Awa", whatsapp: "" }).whatsapp).toBeNull();
    expect(schemaProfil.parse({ nom_complet: "Awa", whatsapp: "077 12 34 56" }).whatsapp).toBe("+241077123456");
    expect(schemaProfil.safeParse({ nom_complet: "Awa", whatsapp: "abc" }).success).toBe(false);
  });
});
