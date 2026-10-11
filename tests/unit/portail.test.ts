import { describe, expect, test } from "vitest";
import { lireCanal, lireCode, lireTelephone, masquerTelephone, messageErreurCode } from "@/lib/portail/regles";

describe("connexion du salarié par téléphone", () => {
  test("lit le numéro saisi localement ou au format international", () => {
    expect(lireTelephone("077 12 34 56", "+241")).toBe("+241077123456");
    expect(lireTelephone("+237 6 99 00 11 22", "+241")).toBe("+237699001122");
    expect(lireTelephone("00241 77123456", "+241")).toBe("+24177123456");
    expect(lireTelephone("abc", "+241")).toBeNull();
    // Indicatif inconnu : on retombe sur le Gabon
    expect(lireTelephone("77123456", "+999")).toBe("+24177123456");
  });

  test("code à 6 chiffres, canal SMS par défaut", () => {
    expect(lireCode(" 123 456 ")).toBe("123456");
    expect(lireCode("12345")).toBeNull();
    expect(lireCode("12a456")).toBeNull();
    expect(lireCanal("whatsapp")).toBe("whatsapp");
    expect(lireCanal("pigeon")).toBe("sms");
  });

  test("numéro masqué et messages clairs", () => {
    expect(masquerTelephone("+24177123456")).toBe("+•••••••3456");
    expect(messageErreurCode("otp_expired")).toContain("expiré");
    expect(messageErreurCode()).toContain("6 chiffres");
  });
});
