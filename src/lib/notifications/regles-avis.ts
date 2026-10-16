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

// ---------------------------------------------------------------------
// Meta (WhatsApp Cloud API)
// ---------------------------------------------------------------------

// Statut signalé par Meta → statut de l'avis
export function statutDepuisMeta(statutMeta: string): StatutAvis | null {
  switch (statutMeta) {
    case "sent":
      return "envoye";
    case "delivered":
      return "recu";
    case "read":
      return "lu";
    case "failed":
      return "echec";
    default:
      return null;
  }
}

// Corps du message pour Meta : modèle approuvé (variables {{1}}, {{2}}… dans l'ordre)
// ou, sans modèle, simple texte (accepté seulement si le destinataire a écrit dans les 24 h).
export function corpsMessageMeta(numero: string, message: { texte: string; variables: Record<string, string> }, modele?: { nom: string; langue: string }) {
  const to = numero.replace(/\D/g, "");
  if (!modele) return { messaging_product: "whatsapp", to, type: "text", text: { body: message.texte } };
  const parametres = Object.keys(message.variables)
    .sort((a, b) => Number(a) - Number(b))
    .map((cle) => ({ type: "text", text: message.variables[cle] }));
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: modele.nom, language: { code: modele.langue }, components: parametres.length ? [{ type: "body", parameters: parametres }] : [] },
  };
}

// Vérifie que l'appel vient bien de Meta (en-tête X-Hub-Signature-256 = « sha256=… »,
// HMAC-SHA256 du corps brut avec le secret de l'application).
export function signatureMetaValide(secret: string, corpsBrut: string, entete: string | null): boolean {
  if (!secret || !entete?.startsWith("sha256=")) return false;
  const attendue = `sha256=${createHmac("sha256", secret).update(corpsBrut, "utf8").digest("hex")}`;
  const a = Buffer.from(attendue);
  const b = Buffer.from(entete);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Refus de Meta ou Twilio → explication en français (affichée à l'utilisateur)
export function expliquerRefusWhatsApp(message: string): string {
  if (/131030|allowed list|liste/i.test(message)) {
    return "Ce numéro n'est pas autorisé par le numéro de test Meta : ajoutez-le dans « Destinataire » (Meta → WhatsApp → Faites un essai) et confirmez le code reçu.";
  }
  if (/131047|131026|re-engagement|24 hours|24 h/i.test(message)) {
    return "WhatsApp n'autorise ce message que si la personne vous a écrit dans les dernières 24 h : envoyez d'abord « bonjour » au numéro WhatsApp de DématPaie, puis réessayez.";
  }
  if (/\(401\)|OAuthException|code\D+190|expired|Session has expired|access token/i.test(message)) {
    return "Le jeton Meta n'est plus valide (le jeton de test expire après 24 h) : générez-en un nouveau, collez-le dans .env.local et relancez DématPaie.";
  }
  if (/132001|template/i.test(message)) return "Le modèle de message WhatsApp est introuvable ou pas encore approuvé.";
  if (/63016|63015|Twilio/i.test(message)) return `Twilio a refusé le message : ${message.slice(0, 160)}`;
  return `Le message n'a pas pu être envoyé : ${message.slice(0, 200)}`;
}
