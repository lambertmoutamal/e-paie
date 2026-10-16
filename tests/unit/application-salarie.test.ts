import { describe, expect, test } from "vitest";
import { lireTailleIcone, logoSvg, manifesteSalarie } from "@/lib/portail/application";

describe("Application installable de l'espace salarié", () => {
  test("le manifeste ne couvre que l'espace salarié et s'ouvre en plein écran", () => {
    const m = manifesteSalarie();
    expect(m).toMatchObject({ start_url: "/portail", scope: "/portail", display: "standalone", lang: "fr" });
    expect(m.icons.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  test("seules les tailles d'icône prévues sont servies", () => {
    expect(lireTailleIcone("192")).toBe(192);
    expect(lireTailleIcone("180")).toBe(180);
    expect(lireTailleIcone("4000")).toBeNull();
    expect(lireTailleIcone("abc")).toBeNull();
  });

  test("l'icône masquable a des marges plus larges", () => {
    expect(logoSvg("standard")).toContain('viewBox="0 0 32 32"');
    expect(logoSvg("masquable")).toContain('viewBox="0 0 46 46"');
  });
});
