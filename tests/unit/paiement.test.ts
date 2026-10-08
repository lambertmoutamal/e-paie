import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { estTermine, montantAPayer, normaliserTelephone } from "@/lib/paiement/regles";
import { signatureWebhookValide, signerRequete, statutDepuisGenuka } from "@/lib/paiement/signature-genuka";

describe("montant à payer", () => {
  test("mensuel : le prix mensuel ; annuel : 10 mois (2 mois offerts)", () => {
    expect(montantAPayer(25000, 1)).toBe(25000);
    expect(montantAPayer(25000, 12)).toBe(250000);
  });
});

describe("numéro Mobile Money", () => {
  test("accepte le format international avec espaces, points ou 00", () => {
    expect(normaliserTelephone("+241 77 12 34 56")).toBe("+24177123456");
    expect(normaliserTelephone("00241.77.12.34.56")).toBe("+24177123456");
    expect(normaliserTelephone("+237 6 77 00 11 22")).toBe("+237677001122");
  });

  test("refuse un numéro sans indicatif pays ou fantaisiste", () => {
    expect(normaliserTelephone("077123456")).toBeNull();
    expect(normaliserTelephone("+241 abc")).toBeNull();
    expect(normaliserTelephone("+0 12 34 56 78")).toBeNull();
  });
});

describe("signature des requêtes Genuka Pay", () => {
  test("signe « horodatage + MÉTHODE + chemin + corps » avec la clé secrète", () => {
    const attendu = createHmac("sha256", "sk_test_secret")
      .update('1791400000POST/api/v1/payments{"amount":100}')
      .digest("hex");
    expect(signerRequete("sk_test_secret", "1791400000", "post", "/api/v1/payments", '{"amount":100}')).toBe(attendu);
  });

  test("une requête GET sans corps signe une chaîne vide en fin", () => {
    const attendu = createHmac("sha256", "s").update("1GET/api/v1/payments/status/abc").digest("hex");
    expect(signerRequete("s", "1", "GET", "/api/v1/payments/status/abc", "")).toBe(attendu);
  });
});

describe("notifications (webhooks) de Genuka Pay", () => {
  const corps = '{"event":"transaction.success","data":{"status":"SUCCESS"}}';
  const secret = "whsec_test";
  const signature = createHmac("sha256", secret).update(corps).digest("hex");

  test("accepte une notification correctement signée", () => {
    expect(signatureWebhookValide(corps, signature, secret)).toBe(true);
  });

  test("refuse une notification falsifiée, non signée ou signée avec un autre secret", () => {
    expect(signatureWebhookValide(corps.replace("SUCCESS", "FAILED"), signature, secret)).toBe(false);
    expect(signatureWebhookValide(corps, null, secret)).toBe(false);
    expect(signatureWebhookValide(corps, signature, "autre_secret")).toBe(false);
    expect(signatureWebhookValide(corps, "abc", secret)).toBe(false);
  });

  test("refuse tout si le secret n'est pas configuré", () => {
    expect(signatureWebhookValide(corps, signature, "")).toBe(false);
  });
});

describe("statuts", () => {
  test("traduit les statuts du prestataire", () => {
    expect(statutDepuisGenuka("SUCCESS")).toBe("reussi");
    expect(statutDepuisGenuka("FAILED")).toBe("echoue");
    expect(statutDepuisGenuka("INITIATED")).toBe("initie");
    expect(statutDepuisGenuka("inconnu")).toBe("en_cours");
  });

  test("distingue les statuts définitifs", () => {
    expect(estTermine("reussi")).toBe(true);
    expect(estTermine("expire")).toBe(true);
    expect(estTermine("en_cours")).toBe(false);
  });
});
