// Règles de l'avis de bulletin par WhatsApp (fonctions pures, testées).

import { createHmac, timingSafeEqual } from "node:crypto";

export type StatutAvis = "simule" | "envoye" | "recu" | "lu" | "echec";

export const LIBELLES_AVIS: Record<StatutAvis, string> = {
  simule: "Simulé (test)",
  envoye: "Envoyé",
  recu: "Reçu",
  lu: "Lu",
  echec: "Échec",
};

// Texte du message (identique au modèle à faire approuver par WhatsApp) et ses variables.
// Le message ne contient ni montant ni fichier : seulement le lien de l'espace salarié.
export function messageAvisBulletin(p: { prenoms: string; periode: string; entreprise: string; lien: string }) {
  const variables = { "1": p.prenoms, "2": p.periode, "3": p.entreprise, "4": p.lien };
  return {
    texte: `Bonjour ${p.prenoms}, votre bulletin de paie de ${p.periode} (${p.entreprise}) est disponible. Consultez-le ici : ${p.lien}`,
    variables,
  };
}

// Statut renvoyé par Twilio → statut de l'avis. Un statut ne recule jamais (« lu » reste « lu »).
const ORDRE: StatutAvis[] = ["simule", "envoye", "recu", "lu"];
export function statutDepuisTwilio(statutTwilio: string): StatutAvis | null {
  switch (statutTwilio) {
    case "queued":
    case "sending":
    case "sent":
    case "accepted":
      return "envoye";
    case "delivered":
      return "recu";
    case "read":
      return "lu";
    case "failed":
    case "undelivered":
      return "echec";
    default:
      return null;
  }
}
export function statutSuivant(actuel: StatutAvis, nouveau: StatutAvis): StatutAvis {
  if (nouveau === "echec") return actuel === "recu" || actuel === "lu" ? actuel : "echec";
  if (actuel === "echec") return nouveau;
  return ORDRE.indexOf(nouveau) > ORDRE.indexOf(actuel) ? nouveau : actuel;
}

// Vérifie que l'appel vient bien de Twilio (en-tête X-Twilio-Signature) :
// HMAC-SHA1, clé = jeton du compte, message = URL complète + paramètres triés (nom + valeur).
export function signatureTwilioValide(jeton: string, url: string, parametres: Record<string, string>, signature: string | null): boolean {
  if (!jeton || !signature) return false;
  const donnees = url + Object.keys(parametres).sort().map((cle) => cle + parametres[cle]).join("");
  const attendue = createHmac("sha1", jeton).update(donnees, "utf8").digest("base64");
  const a = Buffer.from(attendue);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
