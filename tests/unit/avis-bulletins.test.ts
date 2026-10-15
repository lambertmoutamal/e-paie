import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { messageAvisBulletin, signatureTwilioValide, statutDepuisTwilio, statutSuivant } from "@/lib/notifications/regles-avis";

describe("Avis de bulletin par WhatsApp", () => {
  test("le message ne contient que le prénom, la période, l'entreprise et le lien", () => {
    const m = messageAvisBulletin({ prenoms: "Awa", periode: "octobre 2026", entreprise: "SOGEA", lien: "https://dematpaie.ga/portail" });
    expect(m.texte).toBe("Bonjour Awa, votre bulletin de paie de octobre 2026 (SOGEA) est disponible. Consultez-le ici : https://dematpaie.ga/portail");
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
