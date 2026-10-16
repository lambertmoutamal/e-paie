"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { exigerUtilisateur, droitsUtilisateur } from "@/lib/auth/utilisateur";
import { affecterPersonne } from "@/lib/admin/membres";
import { envoyerEmail } from "@/lib/email/envoyer";
import { emailDemandeInformations, emailDemandeRefusee } from "@/lib/email/modeles";
import type { EtatFormulaire } from "@/lib/validation/formulaire";

// Demande lue avec les droits de la personne connectée : seuls les administrateurs du
// cabinet concerné la voient (la base filtre).
async function lireDemande(demandeId: string) {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase
    .from("demandes_entreprise")
    .select("id, raison_sociale, contact_nom, contact_email, statut, cabinets(nom)")
    .eq("id", demandeId)
    .maybeSingle();
  return { supabase, demande: data, cabinet: (data?.cabinets as unknown as { nom: string } | null)?.nom ?? "" };
}

// Acceptation : l'entreprise est créée chez le cabinet, et la personne à contacter reçoit
// son accès (administrateur de l'entreprise).
export async function accepterDemande(demandeId: string): Promise<EtatFormulaire> {
  const { supabase, demande } = await lireDemande(demandeId);
  if (!demande) return { erreur: "Demande introuvable." };
  const { data: entrepriseId, error } = await supabase.rpc("accepter_demande_entreprise", { p_demande_id: demandeId });
  if (error || !entrepriseId) {
    console.error("Acceptation impossible :", error?.code, error?.message);
    return { erreur: error?.code === "42501" ? "Vous ne pouvez pas traiter cette demande." : "La demande n'a pas pu être acceptée (déjà traitée ?)." };
  }
  const invitation = await affecterPersonne(supabase, entrepriseId as string, demande.contact_email, demande.contact_nom, "admin_entreprise");
  refresh();
  return "erreur" in invitation
    ? { succes: `Entreprise créée. L'accès de ${demande.contact_nom} n'a pas pu être créé : ajoutez-le depuis la fiche de l'entreprise.` }
    : { succes: `Entreprise créée. ${invitation.message}` };
}

export async function refuserDemande(demandeId: string): Promise<EtatFormulaire> {
  const { supabase, demande, cabinet } = await lireDemande(demandeId);
  if (!demande) return { erreur: "Demande introuvable." };
  const { error } = await supabase.rpc("refuser_demande_entreprise", { p_demande_id: demandeId });
  if (error) return { erreur: "La demande n'a pas pu être refusée (déjà traitée ?)." };
  after(() =>
    envoyerEmail(demande.contact_email, emailDemandeRefusee({ entreprise: demande.raison_sociale, cabinet })).catch((e) => console.error("Email de refus non envoyé :", e)),
  );
  refresh();
  return { succes: "Demande refusée ; l'entreprise en est informée par email." };
}

const schemaMessage = z.string().trim().min(5, { error: "Écrivez votre question (5 caractères au moins)." }).max(2000);

// Email du cabinet à l'entreprise ; l'entreprise répond directement à l'email du cabinet.
export async function demanderInformations(demandeId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const message = schemaMessage.safeParse(formulaire.get("message") ?? "");
  if (!message.success) return { erreurs: { message: message.error.issues[0].message } };
  const [{ supabase, demande, cabinet }, { profil }] = await Promise.all([lireDemande(demandeId), droitsUtilisateur()]);
  if (!demande) return { erreur: "Demande introuvable." };
  if (demande.statut !== "en_attente") return { erreur: "Cette demande a déjà été traitée." };

  const { error } = await supabase.rpc("noter_demande_informations", { p_demande_id: demandeId });
  if (error) return { erreur: "Vous ne pouvez pas traiter cette demande." };
  try {
    await envoyerEmail(
      demande.contact_email,
      emailDemandeInformations({ cabinet, entreprise: demande.raison_sociale, message: message.data, auteur: profil?.nom_complet || cabinet }),
      profil?.email ?? undefined,
    );
  } catch (erreur) {
    console.error("Demande d'informations non envoyée :", erreur);
    return { erreur: "L'email n'a pas pu être envoyé. Réessayez dans quelques minutes." };
  }
  refresh();
  return { succes: `Email envoyé à ${demande.contact_email}. Sa réponse arrivera directement dans votre boîte mail.` };
}
