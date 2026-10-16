import { describe, expect, test } from "vitest";
import { ajusterImage, disposition, schemaZone, typeImage, zoneEnPoints } from "@/lib/bulletins/regles-signature";

describe("Signature et cachet sur les bulletins", () => {
  test("la case en fractions devient un cadre en points (le PDF compte depuis le bas)", () => {
    // A4 : 595 × 842 points ; case en bas à droite
    expect(zoneEnPoints({ x: 0.6, y: 0.8, largeur: 0.3, hauteur: 0.1 }, 595, 842)).toEqual({ x: 357, y: 842 - 673.6 - 84.2, largeur: 178.5, hauteur: 84.2 });
  });

  test("une image garde ses proportions et reste centrée dans son cadre", () => {
    const cadre = { x: 0, y: 0, largeur: 200, hauteur: 100 };
    expect(ajusterImage(cadre, 400, 400)).toEqual({ x: 50, y: 0, largeur: 100, hauteur: 100 });
    expect(ajusterImage(cadre, 800, 100)).toEqual({ x: 0, y: 37.5, largeur: 200, hauteur: 25 });
  });

  test("cachet à gauche, signature à droite ; une seule image occupe la case", () => {
    const d = disposition({ x: 0, y: 0, largeur: 100, hauteur: 50 }, true, true);
    expect(d.cachet!.x).toBeLessThan(d.signature!.x);
    expect(d.cachet!.largeur).toBeCloseTo(d.signature!.largeur);
    expect(disposition({ x: 0, y: 0, largeur: 100, hauteur: 50 }, false, true).signature!.largeur).toBeCloseTo(94);
    expect(disposition({ x: 0, y: 0, largeur: 100, hauteur: 50 }, false, false)).toEqual({});
  });

  test("la case doit rester dans la page ; seuls de vrais PNG ou JPEG sont acceptés", () => {
    expect(schemaZone.safeParse({ x: 0.6, y: 0.8, largeur: 0.3, hauteur: 0.1 }).success).toBe(true);
    expect(schemaZone.safeParse({ x: 0.8, y: 0.8, largeur: 0.3, hauteur: 0.1 }).success).toBe(false);
    expect(typeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("png");
    expect(typeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(typeImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });
});
