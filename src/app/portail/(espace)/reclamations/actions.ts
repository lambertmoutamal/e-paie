"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaMessageReclamation, schemaNouvelleReclamation } from "@/lib/reclamations/regles";
import { deposerPiece, retirerPiece } from "@/lib/reclamations/pieces";
import { alerterPersonnelReclamation } from "@/lib/notifications/alertes-reclamations";
import { utilisateurConnecte } from "@/lib/auth/connecte";

// Le salarié agit avec sa propre session : la base vérifie qu'il s'agit de SA réclamation.

async function session() {
  const supabase = await clientSupabaseServeur();
  const data = { user: await utilisateurConnecte(supabase) };
  if (!data.user) redirect("/portail/connexion");
  return supabase;
}

const messageBase = (error: { code?: string; message: string }, defaut: string) => (error.code === "P0001" ? error.message : defaut);

export async function ouvrirReclamation(salarieId: string, entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const supabase = await session();
  const lu = lireFormulaire(schemaNouvelleReclamation, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const piece = await deposerPiece(supabase, entrepriseId, salarieId, formulaire);
  if (piece && "erreur" in piece) return { erreurs: { fichier: piece.erreur }, valeurs: lu.valeurs };

  const { data, error } = await supabase.rpc("ouvrir_reclamation", {
    p_salarie_id: salarieId,
    p_sujet: lu.donnees.sujet,
    p_objet: lu.donnees.objet,
    p_message: lu.donnees.message,
    p_bulletin_id: lu.donnees.bulletin_id,
    p_piece_chemin: piece?.chemin ?? null,
    p_piece_nom: piece?.nom ?? null,
  });
  if (error) {
    if (piece) await retirerPiece(supabase, piece.chemin);
    return { erreur: messageBase(error, "La réclamation n'a pas pu être envoyée."), valeurs: lu.valeurs };
  }
  after(() => alerterPersonnelReclamation(data as string));
  redirect(`/portail/reclamations/${data}`);
}

export async function repondreReclamation(
  reclamationId: string,
  salarieId: string,
  entrepriseId: string,
  _e: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const supabase = await session();
  const lu = lireFormulaire(schemaMessageReclamation, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const piece = await deposerPiece(supabase, entrepriseId, salarieId, formulaire);
  if (piece && "erreur" in piece) return { erreurs: { fichier: piece.erreur }, valeurs: lu.valeurs };

  const { error } = await supabase.rpc("ajouter_message_reclamation", {
    p_reclamation_id: reclamationId,
    p_contenu: lu.donnees.contenu,
    p_piece_chemin: piece?.chemin ?? null,
    p_piece_nom: piece?.nom ?? null,
    p_resoudre: false,
  });
  if (error) {
    if (piece) await retirerPiece(supabase, piece.chemin);
    return { erreur: messageBase(error, "Le message n'a pas pu être envoyé."), valeurs: lu.valeurs };
  }
  after(() => alerterPersonnelReclamation(reclamationId));
  refresh();
  return { succes: "Message envoyé." };
}

export async function cloturerReclamation(reclamationId: string) {
  const supabase = await session();
  await supabase.rpc("cloturer_ma_reclamation", { p_reclamation_id: reclamationId });
  refresh();
}
