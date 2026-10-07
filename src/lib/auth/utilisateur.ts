import "server-only";
import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";

// Point d'entrée unique de toute page ou action de l'espace privé :
// vérifie la session auprès de Supabase et renvoie un client qui agit
// au nom de la personne connectée (donc soumis aux règles RLS).
export async function exigerUtilisateur() {
  const supabase = await clientSupabaseServeur();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/connexion");
  return { supabase, utilisateur: data.user };
}

export async function estAdminPlateforme(supabase: Awaited<ReturnType<typeof clientSupabaseServeur>>) {
  const { data } = await supabase.rpc("est_admin_plateforme");
  return data === true;
}
