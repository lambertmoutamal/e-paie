import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UtilisateurConnecte = {
  id: string;
  email: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};

// Personne connectée, vérifiée SUR PLACE : la signature de la session est contrôlée avec la clé
// publique du projet Supabase (mise en cache), ainsi que sa date d'expiration. Contrairement à
// getUser(), aucun aller-retour vers Supabase à chaque page (0,4 à 2 s depuis le Gabon).
// Une session expirée est rafraîchie automatiquement ; sinon null.
export async function utilisateurConnecte(supabase: SupabaseClient): Promise<UtilisateurConnecte | null> {
  const { data, error } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (error || !c?.sub) return null;
  return {
    id: c.sub,
    email: typeof c.email === "string" && c.email ? c.email : null,
    app_metadata: (c.app_metadata ?? {}) as Record<string, unknown>,
    user_metadata: (c.user_metadata ?? {}) as Record<string, unknown>,
  };
}
