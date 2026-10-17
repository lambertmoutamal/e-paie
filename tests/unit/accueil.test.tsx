import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Accueil from "@/app/page";
import PageExpertsComptables from "@/app/experts-comptables/page";
import PageIntrouvable from "@/app/not-found";
import { MODULES } from "@/lib/modules";
import { DUREE_ESSAI_JOURS, TARIFS, formaterPrix } from "@/lib/abonnements/tarifs";
import { lireFormulaire } from "@/lib/validation/formulaire";
import { schemaDemandeDemo } from "@/lib/validation/schemas";

afterEach(cleanup);

describe("site vitrine", () => {
  test("l'accueil affiche la promesse en français", () => {
    render(<Accueil />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("La paie zéro papier");
  });

  test("les appels à l'action mènent à la démo, à l'essai et à la connexion", () => {
    render(<Accueil />);
    const liens = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(liens).toEqual(expect.arrayContaining(["/demo", "/inscription", "/connexion", "/experts-comptables"]));
  });

  test("chaque module est présenté, avec son statut honnête (disponible ou bientôt)", () => {
    render(<Accueil />);
    for (const m of MODULES) expect(screen.getByRole("heading", { name: m.nom })).toBeDefined();
    expect(screen.getAllByText("Disponible").length).toBe(MODULES.filter((m) => m.statut === "disponible").length);
  });

  test("les sections Sécurité et Questions existent (ancres du menu)", () => {
    const { container } = render(<Accueil />);
    expect(container.querySelector("#securite")).not.toBeNull();
    expect(container.querySelector("#questions")).not.toBeNull();
    expect(container.querySelector("#modules")).not.toBeNull();
  });

  test("les inscrits trouvent « Se connecter » dans l'en-tête et dans la promesse", () => {
    render(<Accueil />);
    const connexions = screen.getAllByRole("link", { name: /Se connecter/ }).filter((l) => l.getAttribute("href") === "/connexion");
    // en-tête ordinateur, en-tête téléphone, promesse, tarifs, pied de page
    expect(connexions.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Cabinet ou entreprise déjà inscrit ?")).toBeDefined();
  });

  test("la section Tarifs affiche les deux offres, l'essai d'un mois et mène à l'inscription", () => {
    const { container } = render(<Accueil />);
    const tarifs = container.querySelector("#tarifs") as HTMLElement;
    expect(tarifs).not.toBeNull();
    const texte = (tarifs.textContent ?? "").replace(/ /g, " ");
    expect(texte).toContain("20 000 FCFA");
    expect(texte).toContain("2 000 FCFA");
    expect(texte).toContain("par salarié et par mois");
    expect(within(tarifs).getAllByText("1 mois d'essai gratuit")).toHaveLength(2);
    const liens = within(tarifs).getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(liens).toEqual(expect.arrayContaining(["/inscription?type=cabinet", "/inscription?type=entreprise", "/connexion"]));
    expect(texte).not.toMatch(/Gabon/i);
  });

  test("la page experts-comptables propose une démo pour les cabinets", () => {
    render(<PageExpertsComptables />);
    const liens = screen.getAllByRole("link", { name: /Demander une démo/ });
    expect(liens.some((l) => l.getAttribute("href") === "/demo?type=cabinet")).toBe(true);
  });
});

describe("formulaire de demande de démo", () => {
  const f = (champs: Record<string, string>) => {
    const d = new FormData();
    for (const [k, v] of Object.entries(champs)) d.append(k, v);
    return d;
  };
  const VALIDE = { nom: "Awa Ndong", structure: "Cabinet Okoumé", type: "cabinet", email: "awa@okoume.ga", telephone: "", effectif: "", message: "" };

  test("accepte une demande complète", () => {
    expect(lireFormulaire(schemaDemandeDemo, f(VALIDE)).ok).toBe(true);
  });

  test("exige le nom, la structure et un email valide", () => {
    const lu = lireFormulaire(schemaDemandeDemo, f({ ...VALIDE, nom: "", structure: " ", email: "x" }));
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(Object.keys(lu.erreurs).sort()).toEqual(["email", "nom", "structure"]);
  });

  test("refuse un message trop long", () => {
    expect(lireFormulaire(schemaDemandeDemo, f({ ...VALIDE, message: "x".repeat(2001) })).ok).toBe(false);
  });
});

test("la page introuvable propose un retour à l'accueil", () => {
  render(<PageIntrouvable />);
  const lien = screen.getByRole("link", { name: "Retour à l'accueil" });
  expect(lien.getAttribute("href")).toBe("/");
});

describe("tarifs affichés", () => {
  test("prix en FCFA, sans coupure de ligne au milieu du montant", () => {
    expect(formaterPrix(20000)).toBe("20 000 FCFA");
    expect(formaterPrix(2000)).toBe("2 000 FCFA");
    expect(formaterPrix(0)).toBe("0 FCFA");
  });

  test("cabinet 20 000 par mois, entreprise 2 000 par salarié, essai de 30 jours", () => {
    const cabinet = TARIFS.find((t) => t.cible === "cabinet");
    const entreprise = TARIFS.find((t) => t.cible === "entreprise");
    expect(cabinet?.prixMensuel).toBe(20000);
    expect(entreprise?.prixMensuel).toBe(2000);
    expect(entreprise?.unite).toContain("par salarié");
    expect(DUREE_ESSAI_JOURS).toBe(30);
  });
});
