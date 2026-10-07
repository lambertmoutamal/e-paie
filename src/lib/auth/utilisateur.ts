import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";

// Point d'entrée unique de toute page ou action de l'espace privé :
// vérifie la session auprès de Supabase et renvoie un client qui agit
// au nom de la personne connectée (donc soumis aux règles RLS).
// « cache » : un seul appel par requête, même si la mise en page et la page l'utilisent.
export const exigerUtilisateur = cache(async () => {
  const supabase = await clientSupabaseServeur();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/connexion");
  return { supabase, utilisateur: data.user };
});

export async function estAdminPlateforme(supabase: Awaited<ReturnType<typeof clientSupabaseServeur>>) {
  const { data } = await supabase.rpc("est_admin_plateforme");
  return data === true;
}

// Profil et périmètre de la personne connectée (lu une fois par requête).
export const droitsUtilisateur = cache(async () => {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const [{ data: profil }, { data: cabinets }, { data: affectations }, { data: abonnements }] = await Promise.all([
    supabase
      .from("profils")
      .select("nom_complet, email, est_admin_plateforme")
      .eq("id", utilisateur.id)
      .single(),
    supabase.from("membres_cabinet").select("role, cabinet_id, cabinets(nom)").eq("profil_id", utilisateur.id),
    supabase
      .from("affectations")
      .select("role, entreprise_id, entreprises(raison_sociale)")
      .eq("profil_id", utilisateur.id)
      .eq("actif", true),
    supabase.rpc("mes_abonnements"),
  ]);
  return {
    profil,
    adminPlateforme: profil?.est_admin_plateforme === true,
    cabinets: cabinets ?? [],
    affectations: affectations ?? [],
    abonnements: (abonnements ?? []) as {
      abonnement_id: string;
      titulaire: string;
      phase: import("@/lib/abonnements/phases").Phase;
      jours_restants: number;
      fin_lecture_seule: string;
    }[],
  };
});
