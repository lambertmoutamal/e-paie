"use server";

import { refresh } from "next/cache";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import type { EtatFormulaire } from "@/lib/validation/formulaire";

// Le salarié accepte (ou refuse) de recevoir l'avis de ses bulletins par WhatsApp.
// La base ne modifie que ses propres fiches.
export async function definirAccordWhatsApp(accord: boolean): Promise<EtatFormulaire> {
  if (typeof accord !== "boolean") return { erreur: "Choix invalide." };
  const supabase = await clientSupabaseServeur();
  const { error } = await supabase.rpc("definir_mon_accord_whatsapp", { p_accord: accord });
  if (error) return { erreur: "Votre choix n'a pas pu être enregistré. Réessayez." };
  refresh();
  return { succes: accord ? "C'est noté : vous serez prévenu(e) par WhatsApp." : "C'est noté : plus d'avis par WhatsApp." };
}
