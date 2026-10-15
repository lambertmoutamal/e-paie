import "server-only";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite } from "@/lib/email/envoyer";
import { libellePeriode } from "@/lib/bulletins/regles";
import { envoyerWhatsApp } from "./whatsapp";
import { messageAvisBulletin } from "./regles-avis";

export type BilanAvis = { envoyes: number; echecs: number; sansNumero: number; sansAccord: number; dejaPrevenus: number };

// Avis WhatsApp « votre bulletin est disponible » pour une période publiée.
// Seuls les salariés qui ont un numéro ET ont donné leur accord sont prévenus ; ceux déjà
// prévenus avec succès ne le sont pas deux fois. Appelé après la publication (droits vérifiés
// par la base) ou par « Renvoyer » (droits vérifiés par l'action) : la clé secrète sert
// seulement à lire les numéros et à tracer les envois.
export async function envoyerAvisBulletins(periodeId: string): Promise<BilanAvis> {
  const admin = clientSupabaseAdmin();
  const bilan: BilanAvis = { envoyes: 0, echecs: 0, sansNumero: 0, sansAccord: 0, dejaPrevenus: 0 };

  const { data: periode } = await admin.from("periodes_paie").select("id, entreprise_id, annee, mois, statut, entreprises(raison_sociale)").eq("id", periodeId).maybeSingle();
  if (!periode || periode.statut !== "publiee") return bilan;
  const entreprise = (periode.entreprises as unknown as { raison_sociale: string } | null)?.raison_sociale ?? "";

  const [{ data: bulletins }, { data: avis }] = await Promise.all([
    admin.from("bulletins").select("id, salarie_id, salaries(prenoms, telephone, accord_whatsapp_le)").eq("periode_id", periodeId),
    admin.from("avis_bulletins").select("bulletin_id, statut").eq("periode_id", periodeId),
  ]);
  const prevenus = new Set((avis ?? []).filter((a) => a.statut !== "echec").map((a) => a.bulletin_id));

  const lien = `${adresseSite()}/portail`;
  const jeton = process.env.TWILIO_AUTH_TOKEN;
  const adresseRetour = jeton ? `${adresseSite()}/api/twilio/statut` : undefined;
  const modele = process.env.TWILIO_WHATSAPP_MODELE_BULLETIN;

  for (const b of bulletins ?? []) {
    const s = b.salaries as unknown as { prenoms: string; telephone: string | null; accord_whatsapp_le: string | null } | null;
    if (prevenus.has(b.id)) {
      bilan.dejaPrevenus++;
      continue;
    }
    if (!s?.telephone) {
      bilan.sansNumero++;
      continue;
    }
    if (!s.accord_whatsapp_le) {
      bilan.sansAccord++;
      continue;
    }
    const message = messageAvisBulletin({ prenoms: s.prenoms, periode: libellePeriode(periode.annee, periode.mois).toLowerCase(), entreprise, lien });
    const trace = { bulletin_id: b.id, entreprise_id: periode.entreprise_id, periode_id: periodeId, salarie_id: b.salarie_id };
    try {
      const sid = await envoyerWhatsApp(s.telephone, message, { modele, adresseRetour });
      await admin.from("avis_bulletins").insert({ ...trace, statut: sid ? "envoye" : "simule", message_sid: sid });
      bilan.envoyes++;
    } catch (erreur) {
      console.error("Avis de bulletin non envoyé :", erreur);
      await admin.from("avis_bulletins").insert({ ...trace, statut: "echec", erreur: String(erreur instanceof Error ? erreur.message : erreur).slice(0, 300) });
      bilan.echecs++;
    }
  }
  return bilan;
}
