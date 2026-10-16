import "server-only";
import { createHash } from "node:crypto";
import { PDFDocument } from "@cantoo/pdf-lib";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { ajusterImage, disposition, schemaZone, typeImage, zoneEnPoints } from "./regles-signature";

export type BilanSignature = { signes: number; echecs: number; dejaSignes: number; raison?: string };

// Appose la signature et le cachet de l'entreprise sur chaque bulletin d'une période approuvée
// (ou publiée), dans la case « Émargement employeur » réglée sur la fiche de l'entreprise.
// Le bulletin d'origine n'est jamais modifié : la version signée est enregistrée à côté, avec
// sa propre empreinte. Appelé après la validation finale (droits vérifiés par la base) ou par
// « Apposer » sur la page de la paie (droits vérifiés par l'action).
export async function signerBulletinsPeriode(periodeId: string, refaire = false): Promise<BilanSignature> {
  const admin = clientSupabaseAdmin();
  const bilan: BilanSignature = { signes: 0, echecs: 0, dejaSignes: 0 };

  const { data: periode } = await admin
    .from("periodes_paie")
    .select("id, statut, entreprises(id, signature_chemin, cachet_chemin, zone_emargement)")
    .eq("id", periodeId)
    .maybeSingle();
  if (!periode || !["approuvee", "publiee"].includes(periode.statut)) return { ...bilan, raison: "La paie n'est pas encore approuvée." };
  const e = periode.entreprises as unknown as { id: string; signature_chemin: string | null; cachet_chemin: string | null; zone_emargement: unknown };
  const zone = schemaZone.safeParse(e.zone_emargement);
  if (!zone.success) return { ...bilan, raison: "L'emplacement de la case « Émargement employeur » n'est pas encore réglé (fiche de l'entreprise)." };
  if (!e.signature_chemin && !e.cachet_chemin) return { ...bilan, raison: "Aucune signature ni cachet déposé (fiche de l'entreprise)." };

  // Images de l'entreprise, lues une seule fois
  const lireImage = async (chemin: string | null) => {
    if (!chemin) return null;
    const { data } = await admin.storage.from("signatures").download(chemin);
    if (!data) return null;
    const octets = new Uint8Array(await data.arrayBuffer());
    const type = typeImage(octets);
    return type ? { octets, type } : null;
  };
  const [signature, cachet] = await Promise.all([lireImage(e.signature_chemin), lireImage(e.cachet_chemin)]);
  if (!signature && !cachet) return { ...bilan, raison: "Les images de signature et de cachet sont illisibles : déposez-les à nouveau." };

  const { data: bulletins } = await admin.from("bulletins").select("id, entreprise_id, fichier_chemin, fichier_signe_chemin").eq("periode_id", periodeId);
  for (const b of bulletins ?? []) {
    if (b.fichier_signe_chemin && !refaire) {
      bilan.dejaSignes++;
      continue;
    }
    try {
      const { data: fichier } = await admin.storage.from("bulletins").download(b.fichier_chemin);
      if (!fichier) throw new Error("Bulletin introuvable dans le stockage.");
      const pdf = await PDFDocument.load(new Uint8Array(await fichier.arrayBuffer()), { ignoreEncryption: true });
      const page = pdf.getPage(0);
      const { width, height } = page.getSize();
      const cadres = disposition(zoneEnPoints(zone.data, width, height), Boolean(cachet), Boolean(signature));
      for (const [image, cadre] of [
        [cachet, cadres.cachet],
        [signature, cadres.signature],
      ] as const) {
        if (!image || !cadre) continue;
        const incorporee = image.type === "png" ? await pdf.embedPng(image.octets) : await pdf.embedJpg(image.octets);
        const place = ajusterImage(cadre, incorporee.width, incorporee.height);
        page.drawImage(incorporee, { x: place.x, y: place.y, width: place.largeur, height: place.hauteur });
      }
      const octets = await pdf.save();
      const chemin = `${b.entreprise_id}/${periodeId}/signes/${b.id}.pdf`;
      const { error: erreurDepot } = await admin.storage.from("bulletins").upload(chemin, octets, { contentType: "application/pdf", upsert: true });
      if (erreurDepot) throw erreurDepot;
      const { error } = await admin
        .from("bulletins")
        .update({ fichier_signe_chemin: chemin, empreinte_signee: createHash("sha256").update(octets).digest("hex"), signe_le: new Date().toISOString() })
        .eq("id", b.id);
      if (error) throw error;
      bilan.signes++;
    } catch (erreur) {
      console.error("Signature du bulletin impossible :", b.id, erreur);
      bilan.echecs++;
    }
  }
  return bilan;
}
