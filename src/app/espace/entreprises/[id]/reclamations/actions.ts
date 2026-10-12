"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaMessageReclamation } from "@/lib/reclamations/regles";
import { deposerPiece, retirerPiece } from "@/lib/reclamations/pieces";
import { informerSalarieReclamation } from "@/lib/notifications/alertes-reclamations";

// Réponse du personnel (gestionnaire de paie, RH ou administrateur selon le sujet) :
// la base vérifie que la personne est chargée de ce sujet dans cette entreprise.
export async function repondreReclamation(
  entrepriseId: string,
  salarieId: string,
  reclamationId: string,
  _e: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaMessageReclamation, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const piece = await deposerPiece(supabase, entrepriseId, salarieId, formulaire);
  if (piece && "erreur" in piece) return { erreurs: { fichier: piece.erreur }, valeurs: lu.valeurs };

  const { data, error } = await supabase.rpc("ajouter_message_reclamation", {
    p_reclamation_id: reclamationId,
    p_contenu: lu.donnees.contenu,
    p_piece_chemin: piece?.chemin ?? null,
    p_piece_nom: piece?.nom ?? null,
    p_resoudre: lu.donnees.resoudre,
  });
  if (error) {
    if (piece) await retirerPiece(supabase, piece.chemin);
    return { erreur: error.code === "P0001" ? error.message : "La réponse n'a pas pu être envoyée.", valeurs: lu.valeurs };
  }
  after(() => informerSalarieReclamation(reclamationId));
  refresh();
  return { succes: data === "resolue" ? "Réponse envoyée, réclamation marquée résolue. Le salarié est prévenu." : "Réponse envoyée. Le salarié est prévenu." };
}
