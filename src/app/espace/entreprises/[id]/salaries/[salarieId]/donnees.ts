import "server-only";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";

// Données communes aux pages du dossier salarié (la RLS filtre l'accès).
export async function chargerDossier(entrepriseId: string, salarieId: string) {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const [{ data: salarie }, { data: entreprise }, { data: peutGerer }] = await Promise.all([
    supabase
      .from("salaries")
      .select("id, matricule, nom, prenoms, poste, statut, date_sortie, date_embauche, telephone, email")
      .eq("id", salarieId)
      .eq("entreprise_id", entrepriseId)
      .maybeSingle(),
    supabase.from("entreprises").select("raison_sociale").eq("id", entrepriseId).maybeSingle(),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: entrepriseId }),
  ]);
  if (!salarie || !entreprise) notFound();
  return { supabase, utilisateur, salarie, entreprise, modifiable: peutGerer === true };
}

export function lienFichier(chemin: string) {
  return `/espace/fichiers?chemin=${encodeURIComponent(chemin)}`;
}
