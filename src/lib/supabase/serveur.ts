import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { configSupabase } from "./config";

// Client Supabase pour les pages et actions côté serveur.
// Un nouveau client par requête : il agit au nom de la personne connectée,
// donc toutes ses lectures passent par les règles RLS.
export async function clientSupabaseServeur() {
  // Données propres à chaque visiteur : jamais pré-générées à l'avance.
  // (connection() est nécessaire car Supabase lit l'heure pour vérifier la session.)
  await connection();
  const magasinCookies = await cookies();
  const { url, cle } = configSupabase();

  return createServerClient(url, cle, {
    cookies: {
      getAll() {
        return magasinCookies.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          for (const { name, value, options } of cookiesAEcrire) {
            magasinCookies.set(name, value, options);
          }
        } catch {
          // Appelé depuis une page (lecture seule) : le proxy rafraîchit la session.
        }
      },
    },
  });
}
