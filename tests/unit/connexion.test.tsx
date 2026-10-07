import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { messageErreurConnexion, validerConnexion } from "@/lib/auth/connexion";
import { estCookieDeSession } from "@/lib/auth/session";
import { FormulaireConnexion } from "@/app/connexion/formulaire-connexion";

afterEach(cleanup);

describe("validation de la saisie", () => {
  test("refuse un formulaire vide", () => {
    expect(validerConnexion("", "")).toBe("Veuillez saisir votre email et votre mot de passe.");
  });

  test("refuse un email mal formé", () => {
    expect(validerConnexion("lambert@", "secret")).toBe("L'adresse email n'est pas valide.");
  });

  test("accepte une saisie correcte", () => {
    expect(validerConnexion("lambert@exemple.ga", "secret")).toBeNull();
  });
});

describe("messages d'erreur", () => {
  test("ne révèle pas si c'est l'email ou le mot de passe qui est faux", () => {
    expect(messageErreurConnexion("invalid_credentials", 400)).toBe(
      "Email ou mot de passe incorrect.",
    );
  });

  test("explique un problème de réseau", () => {
    expect(messageErreurConnexion(undefined, 0)).toContain("connexion internet");
  });

  test("signale les tentatives trop nombreuses", () => {
    expect(messageErreurConnexion("over_request_rate_limit", 429)).toContain("Trop de tentatives");
  });
});

describe("cookies effacés à la déconnexion", () => {
  test("reconnaît le cookie de session et ses morceaux", () => {
    expect(estCookieDeSession("sb-jzdsymvyobtyfuusmetk-auth-token")).toBe(true);
    expect(estCookieDeSession("sb-jzdsymvyobtyfuusmetk-auth-token.0")).toBe(true);
    expect(estCookieDeSession("sb-jzdsymvyobtyfuusmetk-auth-token.1")).toBe(true);
  });

  test("ne touche pas aux autres cookies", () => {
    expect(estCookieDeSession("preferences")).toBe(false);
    expect(estCookieDeSession("sb-jzdsymvyobtyfuusmetk-autre")).toBe(false);
  });
});

describe("formulaire de connexion", () => {
  test("affiche les champs en français", () => {
    render(<FormulaireConnexion action={vi.fn()} />);
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Mot de passe")).toBeDefined();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeDefined();
  });

  test("affiche l'erreur renvoyée et conserve l'email saisi", async () => {
    const action = vi.fn().mockResolvedValue({
      erreur: "Email ou mot de passe incorrect.",
      email: "lambert@exemple.ga",
    });
    render(<FormulaireConnexion action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Email ou mot de passe incorrect."),
    );
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("lambert@exemple.ga");
  });
});
