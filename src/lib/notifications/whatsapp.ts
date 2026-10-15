import "server-only";
import { adresseSite } from "@/lib/email/envoyer";
import { corpsMessageMeta } from "./regles-avis";

// Envoi d'un message WhatsApp. Deux fournisseurs possibles (clés dans .env.local) :
//   * Meta, WhatsApp Cloud API (prioritaire s'il est configuré) :
//       META_WHATSAPP_JETON, META_WHATSAPP_NUMERO_ID, META_WHATSAPP_VERSION (facultatif),
//       META_WHATSAPP_MODELE_ALERTE / META_WHATSAPP_MODELE_BULLETIN : noms des modèles approuvés,
//       META_WHATSAPP_LANGUE (facultatif, « fr » par défaut) ;
//   * Twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (ex. whatsapp:+14155238886),
//       TWILIO_WHATSAPP_MODELE / TWILIO_WHATSAPP_MODELE_BULLETIN : identifiants « HX… » des modèles.
// Un modèle approuvé est obligatoire pour écrire à quelqu'un qui n'a pas écrit dans les 24 h.
// Sans configuration : en développement, le message est affiché dans la console ;
// en production, il est simplement ignoré (l'email reste envoyé).
// Renvoie l'identifiant du message chez le fournisseur, ou null si l'envoi est simulé.

export type UsageWhatsApp = "alerte" | "bulletin";

export async function envoyerWhatsApp(numero: string, message: { texte: string; variables: Record<string, string> }, usage: UsageWhatsApp = "alerte"): Promise<string | null> {
  if (process.env.META_WHATSAPP_JETON && process.env.META_WHATSAPP_NUMERO_ID) return envoyerParMeta(numero, message, usage);
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) return envoyerParTwilio(numero, message, usage);
  if (process.env.NODE_ENV !== "production") console.info(`\n[WhatsApp simulé] À : ${numero}\n${message.texte}\n`);
  return null;
}

async function envoyerParMeta(numero: string, message: { texte: string; variables: Record<string, string> }, usage: UsageWhatsApp): Promise<string | null> {
  const nomModele = usage === "bulletin" ? process.env.META_WHATSAPP_MODELE_BULLETIN : process.env.META_WHATSAPP_MODELE_ALERTE;
  const corps = corpsMessageMeta(numero, message, nomModele ? { nom: nomModele, langue: process.env.META_WHATSAPP_LANGUE || "fr" } : undefined);
  const version = process.env.META_WHATSAPP_VERSION || "v22.0";
  const reponse = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(process.env.META_WHATSAPP_NUMERO_ID!)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.META_WHATSAPP_JETON}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(15_000),
  });
  if (!reponse.ok) throw new Error(`Meta a refusé le message WhatsApp (${reponse.status}) : ${await reponse.text()}`);
  console.info(`[WhatsApp Meta] message accepté pour ${numero.slice(0, -4)}••••`);
  const { messages } = (await reponse.json().catch(() => ({}))) as { messages?: { id: string }[] };
  return messages?.[0]?.id ?? null;
}

async function envoyerParTwilio(numero: string, message: { texte: string; variables: Record<string, string> }, usage: UsageWhatsApp): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const jeton = process.env.TWILIO_AUTH_TOKEN!;
  const modele = usage === "bulletin" ? process.env.TWILIO_WHATSAPP_MODELE_BULLETIN : process.env.TWILIO_WHATSAPP_MODELE;

  const corps = new URLSearchParams({ From: process.env.TWILIO_WHATSAPP_FROM!, To: `whatsapp:${numero}` });
  // Twilio signale « reçu », « lu » ou « échec » à cette adresse (appels signés)
  if (usage === "bulletin") corps.set("StatusCallback", `${adresseSite()}/api/twilio/statut`);
  if (modele) {
    corps.set("ContentSid", modele);
    corps.set("ContentVariables", JSON.stringify(message.variables));
  } else {
    corps.set("Body", message.texte);
  }

  const reponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${jeton}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: corps,
    signal: AbortSignal.timeout(15_000),
  });
  if (!reponse.ok) throw new Error(`Twilio a refusé le message WhatsApp (${reponse.status}) : ${await reponse.text()}`);
  console.info(`[WhatsApp Twilio] message accepté pour ${numero.slice(0, -4)}••••`);
  const { sid: identifiant } = (await reponse.json().catch(() => ({}))) as { sid?: string };
  return identifiant ?? null;
}
