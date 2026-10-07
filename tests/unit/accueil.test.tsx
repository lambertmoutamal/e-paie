import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Accueil from "@/app/page";
import PageIntrouvable from "@/app/not-found";

afterEach(cleanup);

test("la page d'accueil affiche le titre en français", () => {
  render(<Accueil />);
  expect(
    screen.getByRole("heading", { level: 1, name: "La paie zéro papier" }),
  ).toBeDefined();
});

test("la page d'accueil présente les deux espaces", () => {
  render(<Accueil />);
  expect(screen.getByRole("heading", { name: "Espace salarié" })).toBeDefined();
  expect(
    screen.getByRole("heading", { name: "Espace cabinet / entreprise" }),
  ).toBeDefined();
});

test("l'espace cabinet / entreprise mène à la page de connexion", () => {
  render(<Accueil />);
  const lien = screen.getByRole("link", { name: "Se connecter" });
  expect(lien.getAttribute("href")).toBe("/connexion");
});

test("la page introuvable propose un retour à l'accueil", () => {
  render(<PageIntrouvable />);
  const lien = screen.getByRole("link", { name: "Retour à l'accueil" });
  expect(lien.getAttribute("href")).toBe("/");
});
