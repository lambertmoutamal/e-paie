import { NextResponse, type NextRequest } from "next/server";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite } from "@/lib/email/envoyer";
import { signatureTwilioValide, statutDepuisTwilio, statutSuivant, type StatutAvis } from "@/lib/notifications/regles-avis";

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
  const sid = parametres.MessageSid;
  if (!nouveau || !sid) return new NextResponse(null, { status: 204 });

  const admin = clientSupabaseAdmin();
  const { data: avis } = await admin.from("avis_bulletins").select("id, statut").eq("message_sid", sid).maybeSingle();
  if (!avis) return new NextResponse(null, { status: 204 });
  const statut = statutSuivant(avis.statut as StatutAvis, nouveau);
  if (statut !== avis.statut) {
    await admin
      .from("avis_bulletins")
      .update({ statut, mis_a_jour_le: new Date().toISOString(), erreur: statut === "echec" ? `Code Twilio ${parametres.ErrorCode ?? "inconnu"}` : null })
      .eq("id", avis.id);
  }
  return new NextResponse(null, { status: 204 });
}
