import "server-only";

// Envoi d'un message WhatsApp via Twilio (API Messages). Clés dans .env.local :
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (ex. whatsapp:+14155238886)
//   TWILIO_WHATSAPP_MODELE (facultatif) : identifiant « HX… » du modèle approuvé par WhatsApp,
//   obligatoire en production pour écrire à quelqu'un qui n'a pas écrit en premier.
// Sans configuration : en développement, le message est affiché dans la console ;
// en production, il est simplement ignoré (l'email reste envoyé).
// Options : `modele` (autre modèle approuvé que celui des alertes), `adresseRetour` (URL que
// Twilio appelle pour signaler « reçu », « lu » ou « échec »).
// Renvoie l'identifiant Twilio du message, ou null si l'envoi est simulé (pas de configuration).
export async function envoyerWhatsApp(
  numero: string,
  message: { texte: string; variables: Record<string, string> },
  options: { modele?: string; adresseRetour?: string } = {},
): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const jeton = process.env.TWILIO_AUTH_TOKEN;
  const expediteur = process.env.TWILIO_WHATSAPP_FROM;
  const modele = options.modele ?? process.env.TWILIO_WHATSAPP_MODELE;

  if (!sid || !jeton || !expediteur) {
    if (process.env.NODE_ENV !== "production") console.info(`\n[WhatsApp simulé] À : ${numero}\n${message.texte}\n`);
    return null;
  }

  const corps = new URLSearchParams({ From: expediteur, To: `whatsapp:${numero}` });
  if (options.adresseRetour) corps.set("StatusCallback", options.adresseRetour);
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
  console.info(`[WhatsApp] message accepté par Twilio pour ${numero.slice(0, -4)}••••`);
  const { sid: identifiant } = (await reponse.json().catch(() => ({}))) as { sid?: string };
  return identifiant ?? null;
}
