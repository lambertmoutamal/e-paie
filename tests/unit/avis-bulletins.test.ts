import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { corpsMessageMeta, messageAvisBulletin, signatureMetaValide, signatureTwilioValide, statutDepuisMeta, statutDepuisTwilio, statutSuivant } from "@/lib/notifications/regles-avis";

describe("Avis de bulletin par WhatsApp", () => {
  test("le message ne contient que le prénom, la période, l'entreprise et le lien", () => {
    const m = messageAvisBulletin({ prenoms: "Awa", periode: "octobre 2026", entreprise: "SOGEA", lien: "https://dematpaie.ga/portail" });
    expect(m.texte).toBe("Bonjour Awa, votre bulletin de paie de octobre 2026 (SOGEA) est disponible dans votre espace salarié : https://dematpaie.ga/portail. Le télécharger vaut accusé de réception.");
    expect(m.variables).toEqual({ "1": "Awa", "2": "octobre 2026", "3": "SOGEA", "4": "https://dematpaie.ga/portail" });
  });

  test("les statuts Twilio ne font jamais reculer l'avis", () => {
    expect(statutDepuisTwilio("delivered")).toBe("recu");
    expect(statutDepuisTwilio("read")).toBe("lu");
    expect(statutDepuisTwilio("undelivered")).toBe("echec");
    expect(statutDepuisTwilio("inconnu")).toBeNull();
    expect(statutSuivant("lu", "recu")).toBe("lu");
    expect(statutSuivant("envoye", "recu")).toBe("recu");
    expect(statutSuivant("recu", "echec")).toBe("recu");
    expect(statutSuivant("envoye", "echec")).toBe("echec");
    expect(statutSuivant("echec", "envoye")).toBe("envoye");
  });

  test("seuls les appels signés par Twilio sont acceptés", () => {
    const url = "https://dematpaie.ga/api/twilio/statut";
    const params = { MessageSid: "SM123", MessageStatus: "delivered" };
    const signature = createHmac("sha1", "jeton-secret").update(`${url}MessageSidSM123MessageStatusdelivered`).digest("base64");
    expect(signatureTwilioValide("jeton-secret", url, params, signature)).toBe(true);
    expect(signatureTwilioValide("autre-jeton", url, params, signature)).toBe(false);
    expect(signatureTwilioValide("jeton-secret", url, { ...params, MessageStatus: "read" }, signature)).toBe(false);
    expect(signatureTwilioValide("jeton-secret", url, params, null)).toBe(false);
  });
});

describe("Envoi par Meta (WhatsApp Cloud API)", () => {
  const message = { texte: "Bonjour Awa", variables: { "2": "octobre 2026", "1": "Awa", "10": "dix" } };

  test("modèle approuvé : variables dans l'ordre {{1}}, {{2}}… ; numéro sans « + »", () => {
    expect(corpsMessageMeta("+241 77 12 34 56", message, { nom: "avis_bulletin", langue: "fr" })).toEqual({
      messaging_product: "whatsapp",
      to: "24177123456",
      type: "template",
      template: {
        name: "avis_bulletin",
        language: { code: "fr" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Awa" }, { type: "text", text: "octobre 2026" }, { type: "text", text: "dix" }] }],
      },
    });
  });

  test("sans modèle : simple texte", () => {
    expect(corpsMessageMeta("+24177123456", message)).toEqual({ messaging_product: "whatsapp", to: "24177123456", type: "text", text: { body: "Bonjour Awa" } });
  });

  test("statuts Meta et signature des appels", () => {
    expect(statutDepuisMeta("delivered")).toBe("recu");
    expect(statutDepuisMeta("read")).toBe("lu");
    expect(statutDepuisMeta("failed")).toBe("echec");
    const corps = '{"entry":[]}';
    const signature = `sha256=${createHmac("sha256", "secret-app").update(corps).digest("hex")}`;
    expect(signatureMetaValide("secret-app", corps, signature)).toBe(true);
    expect(signatureMetaValide("secret-app", `${corps} `, signature)).toBe(false);
    expect(signatureMetaValide("autre", corps, signature)).toBe(false);
    expect(signatureMetaValide("secret-app", corps, null)).toBe(false);
  });
});

describe("Refus WhatsApp expliqués en français", () => {
  test("cas courants de Meta", async () => {
    const { expliquerRefusWhatsApp } = await import("@/lib/notifications/regles-avis");
    expect(expliquerRefusWhatsApp('Meta a refusé le message WhatsApp (400) : {"error":{"message":"(#131030) Recipient phone number not in allowed list"}}')).toContain("Destinataire");
    expect(expliquerRefusWhatsApp("(#131047) Re-engagement message")).toContain("24 h");
    expect(expliquerRefusWhatsApp('Meta a refusé le message WhatsApp (401) : {"error":{"type":"OAuthException","code":190}}')).toContain("jeton");
    expect(expliquerRefusWhatsApp("autre chose")).toContain("autre chose");
  });
});
