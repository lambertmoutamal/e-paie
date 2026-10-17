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

  test("l'écran de choix et le compte restent ouverts", () => {
    expect(exigeEntrepriseChoisie("/choix-entreprise")).toBe(false);
    expect(exigeEntrepriseChoisie("/espace/mot-de-passe")).toBe(false);
    // L'équipe du cabinet se gère au niveau du cabinet, sans entreprise de travail
    expect(exigeEntrepriseChoisie("/espace/equipe")).toBe(false);
    expect(exigeEntrepriseChoisie("/espace/profilXYZ")).toBe(true);
    expect(exigeEntrepriseChoisie("/connexion")).toBe(false);
    expect(exigeEntrepriseChoisie("/espaceX")).toBe(false);
  });
});
