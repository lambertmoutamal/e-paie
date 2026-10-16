import "server-only";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite, envoyerEmail } from "@/lib/email/envoyer";
import { emailActionPaie } from "@/lib/email/modeles";
import { contenuDecision, contenuNouvelleDemande } from "./messages-absences";
import { envoyerWhatsApp } from "./whatsapp";

// Ces fonctions sont appelées après la réponse à l'utilisateur : un échec d'envoi
// est seulement noté dans le journal du serveur, il ne bloque jamais l'action.

async function envoyer(email: string | null, whatsapp: string | null, contenu: ReturnType<typeof contenuNouvelleDemande>, lien: string) {
  const envois: Promise<unknown>[] = [];
  if (email) envois.push(envoyerEmail(email, emailActionPaie(contenu, lien)));
  if (whatsapp) envois.push(envoyerWhatsApp(whatsapp, { texte: contenu.whatsapp, variables: contenu.variables }));
  for (const r of await Promise.allSettled(envois)) if (r.status === "rejected") console.error("Alerte d'absence non envoyée :", r.reason);
}

// Nouvelle demande : le RH de l'entreprise (ou, sans RH, les administrateurs) est prévenu.
export async function alerterNouvelleDemande(demandeId: string): Promise<void> {
  try {
    const { data, error } = await clientSupabaseAdmin().rpc("destinataires_demande_absence", { p_demande_id: demandeId });
    if (error) throw error;
    for (const d of data ?? []) {
      const lien = `${adresseSite()}/espace/entreprises/${d.entreprise_id}/absences`;
      const contenu = contenuNouvelleDemande({
        nom: d.nom_complet,
        salarie: d.salarie,
        type: d.type_libelle,
        entreprise: d.raison_sociale,
        debut: d.debut,
        fin: d.fin,
        nb_jours: d.nb_jours,
        lien,
      });
      await envoyer(d.email, d.whatsapp, contenu, lien);
    }
  } catch (erreur) {
    console.error("Alertes de demande d'absence impossibles :", erreur);
  }
}

// Décision (ou absence saisie par le RH) : le salarié est prévenu sur son téléphone et par email s'il en a un.
export async function informerSalarie(demandeId: string): Promise<void> {
  try {
    const { data, error } = await clientSupabaseAdmin().rpc("infos_decision_absence", { p_demande_id: demandeId });
    if (error) throw error;
    const d = data?.[0];
    if (!d) return;
    const lien = `${adresseSite()}/portail/absences`;
    const contenu = contenuDecision({
      prenoms: d.prenoms,
      type: d.type_libelle,
      entreprise: d.raison_sociale,
      debut: d.debut,
      fin: d.fin,
      nb_jours: d.nb_jours,
      statut: d.statut,
      commentaire: d.commentaire,
      lien,
    });
    await envoyer(d.email, d.telephone, contenu, lien);
  } catch (erreur) {
    console.error("Information du salarié impossible :", erreur);
  }
}
