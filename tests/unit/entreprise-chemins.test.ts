import { describe, expect, test } from "vitest";
import { exigeEntrepriseChoisie } from "@/lib/entreprise-chemins";

describe("une seule entreprise à la fois", () => {
  test("les pages de travail exigent une entreprise choisie", () => {
    expect(exigeEntrepriseChoisie("/espace")).toBe(true);
    expect(exigeEntrepriseChoisie("/espace/etats/livre-de-paie")).toBe(true);
    expect(exigeEntrepriseChoisie("/espace/entreprises")).toBe(true);
    expect(exigeEntrepriseChoisie("/espace/entreprises/abc/salaries")).toBe(true);
    expect(exigeEntrepriseChoisie("/espace/a-faire")).toBe(true);
    expect(exigeEntrepriseChoisie("/espace/recherche")).toBe(true);
  });

  test("l'écran de choix, le compte et la création d'entreprise restent ouverts", () => {
    expect(exigeEntrepriseChoisie("/espace/choisir-entreprise")).toBe(false);
    expect(exigeEntrepriseChoisie("/espace/mot-de-passe")).toBe(false);
    expect(exigeEntrepriseChoisie("/espace/entreprises/nouvelle")).toBe(false);
    expect(exigeEntrepriseChoisie("/espace/profilXYZ")).toBe(true);
    expect(exigeEntrepriseChoisie("/connexion")).toBe(false);
    expect(exigeEntrepriseChoisie("/espaceX")).toBe(false);
  });
});
