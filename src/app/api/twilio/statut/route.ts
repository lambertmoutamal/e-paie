import { NextResponse, type NextRequest } from "next/server";
import { adresseSite } from "@/lib/email/envoyer";
import { mettreAJourAvis } from "@/lib/notifications/avis-bulletins";
import { signatureTwilioValide, statutDepuisTwilio } from "@/lib/notifications/regles-avis";

// Twilio signale ici l'état de chaque avis WhatsApp (reçu, lu, échec).
// L'appel n'est accepté que s'il est signé par Twilio avec le jeton du compte.
export async function POST(requete: NextRequest) {
  const formulaire = await requete.formData();
  const parametres = Object.fromEntries([...formulaire.entries()].map(([cle, v]) => [cle, String(v)]));
  const url = `${adresseSite()}/api/twilio/statut`;
  if (!signatureTwilioValide(process.env.TWILIO_AUTH_TOKEN ?? "", url, parametres, requete.headers.get("x-twilio-signature"))) {
    return new NextResponse("Signature invalide.", { status: 403 });
  }
  const nouveau = statutDepuisTwilio(parametres.MessageStatus ?? "");
  if (nouveau && parametres.MessageSid) await mettreAJourAvis(parametres.MessageSid, nouveau, `Code Twilio ${parametres.ErrorCode ?? "inconnu"}`);
  return new NextResponse(null, { status: 204 });
}
