import "server-only";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite, envoyerEmail } from "@/lib/email/envoyer";
import { emailActionPaie } from "@/lib/email/modeles";
import { contenuReclamationPersonnel, contenuReponseSalarie } from "./messages-reclamations";
import { envoyerWhatsApp } from "./whatsapp";

// Appelées après la réponse à l'utilisateur : un échec d'envoi est seulement noté.

async function envoyer(email: string | null, whatsapp: string | null, contenu: ReturnType<typeof contenuReponseSalarie>, lien: string) {
  const envois: Promise<void>[] = [];
  if (email) envois.push(envoyerEmail(email, emailActionPaie(contenu, lien)));
  if (whatsapp) envois.push(envoyerWhatsApp(whatsapp, { texte: contenu.whatsapp, variables: contenu.variables }));
  for (const r of await Promise.allSettled(envois)) if (r.status === "rejected") console.error("Alerte de réclamation non envoyée :", r.reason);
}

// Le salarié a écrit : les personnes chargées du sujet sont prévenues.
export async function alerterPersonnelReclamation(reclamationId: string): Promise<void> {
  try {
    const { data, error } = await clientSupabaseAdmin().rpc("destinataires_reclamation", { p_reclamation_id: reclamationId });
    if (error) throw error;
    for (const d of data ?? []) {
      const lien = `${adresseSite()}/espace/entreprises/${d.entreprise_id}/reclamations/${reclamationId}`;
      const contenu = contenuReclamationPersonnel({ nom: d.nom_complet, salarie: d.salarie, entreprise: d.raison_sociale, sujet: d.sujet, objet: d.objet, lien });
      await envoyer(d.email, d.whatsapp, contenu, lien);
    }
  } catch (erreur) {
    console.error("Alertes de réclamation impossibles :", erreur);
  }
}

// L'entreprise a répondu : le salarié est prévenu sur son téléphone (et par email s'il en a un).
export async function informerSalarieReclamation(reclamationId: string): Promise<void> {
  try {
    const { data, error } = await clientSupabaseAdmin().rpc("infos_reponse_reclamation", { p_reclamation_id: reclamationId });
    if (error) throw error;
    const d = data?.[0];
    if (!d) return;
    const lien = `${adresseSite()}/portail/reclamations/${reclamationId}`;
    await envoyer(d.email, d.telephone, contenuReponseSalarie({ prenoms: d.prenoms, entreprise: d.raison_sociale, objet: d.objet, statut: d.statut, lien }), lien);
  } catch (erreur) {
    console.error("Information du salarié (réclamation) impossible :", erreur);
  }
}
