import { NextResponse, type NextRequest } from "next/server";
import { mettreAJourAvis } from "@/lib/notifications/avis-bulletins";
import { signatureMetaValide, statutDepuisMeta } from "@/lib/notifications/regles-avis";

// Adresse de rappel (« webhook ») de Meta pour WhatsApp.
// GET : vérification lors de l'enregistrement de l'adresse dans Meta (jeton de vérification choisi
// par vous : META_WHATSAPP_JETON_VERIFICATION).
export async function GET(requete: NextRequest) {
  const p = requete.nextUrl.searchParams;
  const attendu = process.env.META_WHATSAPP_JETON_VERIFICATION;
  if (attendu && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === attendu) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Vérification refusée.", { status: 403 });
}

// POST : état de chaque message (envoyé, reçu, lu, échec). Accepté seulement s'il est signé
// par Meta avec le secret de l'application (META_APP_SECRET).
export async function POST(requete: NextRequest) {
  const corps = await requete.text();
  if (!signatureMetaValide(process.env.META_APP_SECRET ?? "", corps, requete.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Signature invalide.", { status: 403 });
  }
  type Statut = { id?: string; status?: string; errors?: { code?: number; title?: string }[] };
  let donnees: { entry?: { changes?: { value?: { statuses?: Statut[] } }[] }[] };
  try {
    donnees = JSON.parse(corps);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  for (const entree of donnees.entry ?? []) {
    for (const changement of entree.changes ?? []) {
      for (const s of changement.value?.statuses ?? []) {
        const nouveau = statutDepuisMeta(s.status ?? "");
        const erreur = s.errors?.[0];
        if (nouveau && s.id) await mettreAJourAvis(s.id, nouveau, erreur ? `Meta ${erreur.code ?? ""} : ${erreur.title ?? ""}` : undefined);
      }
    }
  }
  return new NextResponse(null, { status: 200 });
}
