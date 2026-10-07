import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Champ, Formulaire, MessageEtat } from "@/components/formulaire";

afterEach(cleanup);

test("deux formulaires sur la même page ne partagent jamais un champ", () => {
  render(
    <>
      <Formulaire action={vi.fn()} libelleBouton="Enregistrer la fiche">
        <Champ nom="email" libelle="Email de l'entreprise" />
      </Formulaire>
      <Formulaire action={vi.fn()} libelleBouton="Ajouter la personne">
        <Champ nom="email" libelle="Email de la personne" />
      </Formulaire>
    </>,
  );

  const champEntreprise = screen.getByLabelText("Email de l'entreprise");
  const champPersonne = screen.getByLabelText("Email de la personne");
  expect(champEntreprise).not.toBe(champPersonne);
  expect(champEntreprise.id).not.toBe(champPersonne.id);
  expect(champPersonne.closest("form")).toBe(
    screen.getByRole("button", { name: "Ajouter la personne" }).closest("form"),
  );
});

test("les messages de réussite et d'erreur sont annoncés aux lecteurs d'écran", () => {
  render(<MessageEtat etat={{ succes: "Invitation envoyée.", erreur: "Échec partiel." }} />);
  expect(screen.getByRole("status").textContent).toBe("Invitation envoyée.");
  expect(screen.getByRole("alert").textContent).toBe("Échec partiel.");
});
