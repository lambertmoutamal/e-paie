import { describe, expect, test } from "vitest";
import { enLettres } from "@/lib/paie/lettres";

describe("montant en toutes lettres", () => {
  test("cas courants et pièges de l'orthographe", () => {
    expect(enLettres(0)).toBe("zéro");
    expect(enLettres(21)).toBe("vingt et un");
    expect(enLettres(71)).toBe("soixante et onze");
    expect(enLettres(80)).toBe("quatre-vingts");
    expect(enLettres(81)).toBe("quatre-vingt-un");
    expect(enLettres(91)).toBe("quatre-vingt-onze");
    expect(enLettres(97)).toBe("quatre-vingt-dix-sept");
    expect(enLettres(200)).toBe("deux cents");
    expect(enLettres(250)).toBe("deux cent cinquante");
    expect(enLettres(1000)).toBe("mille");
    expect(enLettres(80000)).toBe("quatre-vingt mille");
    expect(enLettres(200000)).toBe("deux cent mille");
    expect(enLettres(1_000_000)).toBe("un million");
    expect(enLettres(2_480_500)).toBe("deux millions quatre cent quatre-vingt mille cinq cents");
    expect(enLettres(320_000.4)).toBe("trois cent vingt mille");
  });
});
