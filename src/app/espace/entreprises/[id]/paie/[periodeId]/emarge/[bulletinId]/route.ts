import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "@cantoo/pdf-lib";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { libellePeriode } from "@/lib/bulletins/regles";

const HORODATAGE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Libreville" });
const horodater = (d: string | Date) => HORODATAGE.format(new Date(d)).replace(" ", " à ");

// Exemplaire employeur du bulletin, avec la mention d'émargement électronique en bas de page
// (date et heure du premier téléchargement par le salarié). Le fichier d'origine n'est jamais
// modifié : son empreinte figure sur la mention. La base limite l'accès à l'entreprise.
export async function GET(_requete: NextRequest, { params }: RouteContext<"/espace/entreprises/[id]/paie/[periodeId]/emarge/[bulletinId]">) {
  const { id, periodeId, bulletinId } = await params;
  const supabase = await clientSupabaseServeur();
  const [{ data: bulletin }, { data: emargement }] = await Promise.all([
    supabase
      .from("bulletins")
      .select("fichier_chemin, fichier_signe_chemin, empreinte_sha256, salaries(matricule, nom, prenoms), periodes_paie(annee, mois)")
      .eq("id", bulletinId)
      .eq("periode_id", periodeId)
      .eq("entreprise_id", id)
      .maybeSingle(),
    supabase.from("emargements_bulletins").select("emarge_le").eq("bulletin_id", bulletinId).maybeSingle(),
  ]);
  if (!bulletin) return new NextResponse("Bulletin introuvable.", { status: 404 });

  // Version signée par l'employeur si elle existe, sinon le bulletin d'origine
  const { data: fichier, error } = await supabase.storage.from("bulletins").download(bulletin.fichier_signe_chemin ?? bulletin.fichier_chemin);
  if (error || !fichier) return new NextResponse("Bulletin introuvable.", { status: 404 });

  const s = bulletin.salaries as unknown as { matricule: string; nom: string; prenoms: string };
  const p = bulletin.periodes_paie as unknown as { annee: number; mois: number };
  const lignes = emargement
    ? [
        `ÉMARGEMENT ÉLECTRONIQUE — Bulletin reçu par ${s.nom} ${s.prenoms} (matricule ${s.matricule}) le ${horodater(emargement.emarge_le)},`,
        "par téléchargement depuis son espace salarié DématPaie (le téléchargement vaut accusé de réception).",
      ]
    : [`NON ÉMARGÉ — ${s.nom} ${s.prenoms} (matricule ${s.matricule}) n'a pas encore téléchargé ce bulletin (situation au ${horodater(new Date())}).`];
  lignes.push(`Empreinte SHA-256 du bulletin d'origine : ${bulletin.empreinte_sha256}`);

  const pdf = await PDFDocument.load(new Uint8Array(await fichier.arrayBuffer()), { ignoreEncryption: true });
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPage(0);
  const { width } = page.getSize();
  const taille = 6.5;
  const hauteur = lignes.length * (taille + 2.5) + 8;
  page.drawRectangle({ x: 14, y: 6, width: width - 28, height: hauteur, color: rgb(1, 1, 1), opacity: 0.92, borderColor: emargement ? rgb(0.31, 0.27, 0.9) : rgb(0.85, 0.2, 0.2), borderWidth: 0.6 });
  lignes.forEach((ligne, i) => {
    page.drawText(ligne, { x: 20, y: 6 + hauteur - 4 - (i + 1) * (taille + 2.5) + 2, size: taille, font: police, color: rgb(0.1, 0.12, 0.2), maxWidth: width - 40 });
  });

  const octets = await pdf.save();
  const nom = `Bulletin ${libellePeriode(p.annee, p.mois)} - ${s.matricule}${emargement ? " - émargé" : ""}.pdf`;
  return new NextResponse(octets as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
