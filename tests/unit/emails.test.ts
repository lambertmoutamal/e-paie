import { describe, expect, test } from "vitest";
import { echapper, emailAccesAjoute, emailInvitation, emailRecuperation } from "@/lib/email/modeles";

const LIEN = "https://e-paie.exemple.ga/auth/confirmer?token_hash=abc123&type=invite";

describe("emails", () => {
  test("l'invitation contient le bouton d'activation, le nom et le périmètre", () => {
    const email = emailInvitation({ nom: "Awa Ndong", perimetre: "Gestionnaire de paie · CONCEPT PART", lien: LIEN });
    expect(email.sujet).toBe("Activez votre compte e-Paie");
    expect(email.html).toContain("Activer mon compte");
    expect(email.html).toContain("Awa Ndong");
    expect(email.html).toContain("CONCEPT PART");
    expect(email.html).toContain(echapper(LIEN));
    expect(email.texte).toContain(LIEN);
    expect(email.texte).toContain("24 heures");
  });

  test("un nom piégé ne peut pas injecter de code dans l'email", () => {
    const email = emailInvitation({ nom: '<script>alert("x")</script>', perimetre: "<b>X</b>", lien: LIEN });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>X</b>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  test("l'email de réinitialisation rassure si la demande ne vient pas de la personne", () => {
    const email = emailRecuperation({ lien: LIEN });
    expect(email.html).toContain("Choisir un nouveau mot de passe");
    expect(email.texte).toContain("ignorez cet email");
  });

  test("l'avis d'accès ajouté contient le lien de connexion", () => {
    const email = emailAccesAjoute({ nom: "Awa", perimetre: "RH · OKOUMÉ SA", lienConnexion: "https://e-paie.exemple.ga/connexion" });
    expect(email.html).toContain("https://e-paie.exemple.ga/connexion");
    expect(email.html).toContain("OKOUMÉ SA");
  });
});
