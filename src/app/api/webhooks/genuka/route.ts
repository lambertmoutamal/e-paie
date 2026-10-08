import { signatureWebhookValide, statutDepuisGenuka } from "@/lib/paiement/signature-genuka";
import { enregistrerResultat } from "@/lib/paiement/service";

// Notifications de Genuka Pay (paiement réussi, échoué…).
// Sécurité : la signature HMAC du corps brut est vérifiée AVANT toute lecture ;
// une notification non signée ou falsifiée est rejetée.
export async function POST(requete: Request) {
  const corpsBrut = await requete.text();
  const secret = process.env.GENUKA_WEBHOOK_SECRET ?? "";
  if (!signatureWebhookValide(corpsBrut, requete.headers.get("signature"), secret)) {
    return Response.json({ erreur: "Signature invalide" }, { status: 401 });
  }

  let evenement: {
    event?: string;
    data?: {
      transaction_id?: string;
      status?: string;
      provider_fee_amount?: number;
      genuka_fee_amount?: number;
      total_fee_amount?: number;
      net_amount?: number;
      metadata?: { external_id?: string };
      external_id?: string;
    };
  };
  try {
    evenement = JSON.parse(corpsBrut);
  } catch {
    return Response.json({ erreur: "Corps invalide" }, { status: 400 });
  }

  // Seuls les événements de paiement nous intéressent ; les autres sont acquittés.
  if (!evenement.event?.startsWith("transaction.")) return Response.json({ recu: true });

  const paiementId = evenement.data?.metadata?.external_id ?? evenement.data?.external_id;
  if (!paiementId || !/^[0-9a-f-]{36}$/i.test(paiementId)) return Response.json({ recu: true, ignore: "référence absente" });

  try {
    await enregistrerResultat(paiementId, statutDepuisGenuka(evenement.data?.status), {
      reference: evenement.data?.transaction_id ?? null,
      frais: evenement.data?.total_fee_amount ?? null,
      net: evenement.data?.net_amount ?? null,
    });
  } catch (erreur) {
    console.error("Webhook Genuka non appliqué :", erreur);
    // 500 : Genuka renverra la notification plus tard.
    return Response.json({ erreur: "Traitement impossible" }, { status: 500 });
  }
  return Response.json({ recu: true });
}
