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

test("le mot de passe provisoire est affiché avec l'avertissement « une seule fois »", () => {
  render(<MessageEtat etat={{ compteCree: { email: "a@exemple.ga", motDePasse: "Kx7m-Pq2r-Zt9w" } }} />);
  expect(screen.getByText("Kx7m-Pq2r-Zt9w")).toBeDefined();
  expect(screen.getByText("Il ne sera plus jamais affiché.")).toBeDefined();
});
