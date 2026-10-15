import "server-only";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite, envoyerEmail } from "@/lib/email/envoyer";
import { emailActionPaie } from "@/lib/email/modeles";
import { contenuAlerte, type MotifAlerte } from "./messages-paie";
import { envoyerWhatsApp } from "./whatsapp";

type Destinataire = {
  motif: MotifAlerte;
  profil_id: string;
  email: string;
  whatsapp: string | null;
  nom_complet: string;
  raison_sociale: string;
  entreprise_id: string;
  annee: number;
  mois: number;
  libelle_etape: string;
  commentaire: string | null;
};

// Prévient (email + WhatsApp si renseigné) les personnes qui doivent agir sur la période,
// d'après son état actuel. La base choisit les destinataires avec les mêmes règles que
// le circuit. Appelé après la réponse à l'utilisateur : un échec d'envoi ne bloque rien.
// « seulementPour » : ne prévenir qu'une personne (ex. qui vient de recevoir un rôle).
export async function alerterPaie(periodeId: string, seulementPour?: string): Promise<void> {
  try {
    const { data, error } = await clientSupabaseAdmin().rpc("destinataires_alerte", { p_periode_id: periodeId });
    if (error) throw error;
    const destinataires = ((data ?? []) as Destinataire[]).filter((d) => !seulementPour || d.profil_id === seulementPour);

    await Promise.allSettled(
      destinataires.map(async (d) => {
        const lien = `${adresseSite()}/espace/entreprises/${d.entreprise_id}/paie/${periodeId}`;
        const contenu = contenuAlerte({
          motif: d.motif,
          nom: d.nom_complet,
          entreprise: d.raison_sociale,
          annee: d.annee,
          mois: d.mois,
          etape: d.libelle_etape,
          commentaire: d.commentaire,
          lien,
        });
        const envois: Promise<unknown>[] = [envoyerEmail(d.email, emailActionPaie(contenu, lien))];
        if (d.whatsapp) envois.push(envoyerWhatsApp(d.whatsapp, { texte: contenu.whatsapp, variables: contenu.variables }));
        const resultats = await Promise.allSettled(envois);
        for (const r of resultats) if (r.status === "rejected") console.error("Alerte de paie non envoyée :", r.reason);
      }),
    );
  } catch (erreur) {
    console.error("Alertes de paie impossibles :", erreur);
  }
}

// Une personne vient de recevoir un rôle dans l'entreprise : si des paies l'attendent
// déjà (à valider, à publier), elle est prévenue tout de suite.
export async function alerterNouveauRole(entrepriseId: string, profilId: string): Promise<void> {
  const { data } = await clientSupabaseAdmin()
    .from("periodes_paie")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .in("statut", ["en_validation", "approuvee"]);
  for (const p of data ?? []) await alerterPaie(p.id, profilId);
}
