"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { schemaImportResultats } from "@/lib/paie/import-resultats";

export type ResultatImport = { ok: true; nombre: number } | { ok: false; erreur: string };

// Enregistre les résultats de paie importés (un par salarié ; un nouvel import remplace
// l'ancien). La base vérifie les droits, l'entreprise et que la période est en brouillon.
export async function importerResultats(entrepriseId: string, periodeId: string, donnees: unknown): Promise<ResultatImport> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const lu = schemaImportResultats.safeParse(donnees);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0]?.message ?? "Données invalides." };

  const { data: periode } = await supabase.from("periodes_paie").select("statut").eq("id", periodeId).eq("entreprise_id", entrepriseId).maybeSingle();
  if (!periode) return { ok: false, erreur: "Période introuvable." };
  if (periode.statut !== "brouillon") return { ok: false, erreur: "Cette période est verrouillée : elle n'est plus en brouillon." };

  const maintenant = new Date().toISOString();
  const lignes = lu.data.map((l) => ({
    entreprise_id: entrepriseId,
    periode_id: periodeId,
    salarie_id: l.salarie_id,
    ...l.champs,
    rubriques: l.rubriques,
    importe_par: utilisateur.id,
    importe_le: maintenant,
  }));
  for (let i = 0; i < lignes.length; i += 500) {
    const { error } = await supabase.from("resultats_paie").upsert(lignes.slice(i, i + 500), { onConflict: "periode_id,salarie_id" });
    if (error) {
      console.error("Import des résultats de paie impossible :", error.code, error.message);
      return { ok: false, erreur: error.code === "42501" ? "Vous ne pouvez pas importer de résultats pour cette entreprise." : "L'import a échoué." };
    }
  }
  refresh();
  return { ok: true, nombre: lignes.length };
}

export async function supprimerResultats(entrepriseId: string, periodeId: string) {
  const { supabase } = await exigerUtilisateur();
  await supabase.from("resultats_paie").delete().eq("entreprise_id", entrepriseId).eq("periode_id", periodeId);
  refresh();
}
