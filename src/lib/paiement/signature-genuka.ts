import { createHmac, timingSafeEqual } from "node:crypto";
import type { StatutPaiement } from "./regles";

// Signature des requêtes envoyées à Genuka Pay : HMAC-SHA256 (clé secrète) de
// « horodatage + MÉTHODE + chemin (avec paramètres) + corps brut », sans séparateur.
export function signerRequete(cleSecrete: string, horodatage: string, methode: string, chemin: string, corps: string): string {
  return createHmac("sha256", cleSecrete)
    .update(`${horodatage}${methode.toUpperCase()}${chemin}${corps}`)
    .digest("hex");
}

// Vérification d'une notification (webhook) reçue de Genuka Pay :
// HMAC-SHA256 du corps BRUT avec le secret du webhook, comparé en temps constant.
export function signatureWebhookValide(corpsBrut: string, signatureRecue: string | null, secret: string): boolean {
  if (!signatureRecue || !secret) return false;
  const attendue = Buffer.from(createHmac("sha256", secret).update(corpsBrut).digest("hex"), "utf8");
  const recue = Buffer.from(signatureRecue.trim(), "utf8");
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}

const STATUTS: Record<string, StatutPaiement> = {
  INITIATED: "initie",
  PROCESSING: "en_cours",
  SUCCESS: "reussi",
  FAILED: "echoue",
  EXPIRED: "expire",
  CANCELLED: "annule",
};

export function statutDepuisGenuka(statut: string | undefined): StatutPaiement {
  return STATUTS[String(statut ?? "").toUpperCase()] ?? "en_cours";
}
