"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";

// Marque une demande comme traitée (ou la rouvre). La base n'autorise que l'admin plateforme.
export async function basculerTraitement(demandeId: string, traitee: boolean) {
  const { supabase } = await exigerUtilisateur();
  await supabase
    .from("demandes_demo")
    .update({ traitee_le: traitee ? new Date().toISOString() : null })
    .eq("id", demandeId);
  refresh();
}
