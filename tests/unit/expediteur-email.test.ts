import { describe, expect, test } from "vitest";
import { expediteurDematPaie } from "@/lib/email/expediteur";

describe("expéditeur des emails", () => {
  test("l'ancien nom « e-Paie » est remplacé par DématPaie", () => {
    expect(expediteurDematPaie("e-Paie <noreply@synergieplusgabon.com>")).toBe("DématPaie <noreply@synergieplusgabon.com>");
  });

  test("une adresse seule reçoit le nom DématPaie", () => {
    expect(expediteurDematPaie(" noreply@exemple.ga ")).toBe("DématPaie <noreply@exemple.ga>");
  });

  test("une valeur vide ou invalide est refusée", () => {
    expect(expediteurDematPaie("")).toBeNull();
    expect(expediteurDematPaie("e-Paie")).toBeNull();
  });
});
