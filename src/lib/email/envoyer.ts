import "server-only";
import type { Email } from "./modeles";

// Envoi via Resend (https://resend.com). Clé et expéditeur dans .env.local.
// Sans clé, en développement uniquement, l'email est affiché dans la console
// du serveur (pour tester sans configuration). En production, c'est une erreur.
export async function envoyerEmail(destinataire: string, email: Email): Promise<void> {
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.EMAIL_EXPEDITEUR;

  if (!cle || !expediteur) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Envoi d'emails non configuré (RESEND_API_KEY / EMAIL_EXPEDITEUR).");
    }
    console.info(`\n[email simulé] À : ${destinataire}\nSujet : ${email.sujet}\n${email.texte}\n`);
    return;
  }

  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: expediteur, to: [destinataire], subject: email.sujet, html: email.html, text: email.texte }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!reponse.ok) {
    throw new Error(`Resend a refusé l'envoi (${reponse.status}) : ${await reponse.text()}`);
  }
}

export function adresseSite(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL manquant dans .env.local.");
  return url.replace(/\/$/, "");
}

export const TYPES_LIEN = ["invite", "magiclink", "signup", "email", "recovery"] as const;
export type TypeLien = (typeof TYPES_LIEN)[number];

// Le lien mène à une page de confirmation (bouton « Activer ») et non à une
// activation directe : certaines messageries ouvrent automatiquement les liens
// pour les analyser, ce qui consommerait le lien à usage unique.
export function lienConfirmation(jeton: string, type: TypeLien): string {
  const params = new URLSearchParams({ token_hash: jeton, type });
  return `${adresseSite()}/auth/confirmer?${params}`;
}
