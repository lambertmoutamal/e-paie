import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configSupabase } from "./config";

// Client « administrateur » : utilise la clé secrète et CONTOURNE la RLS.
// - « server-only » fait échouer la construction si ce fichier est importé
//   par erreur dans du code exécuté par le navigateur.
// - À n'utiliser qu'après avoir vérifié les droits de la personne connectée
//   (voir peut_gerer_entreprise / peut_gerer_cabinet).
export function clientSupabaseAdmin() {
  const { url } = configSupabase();
  const cleSecrete = process.env.SUPABASE_SECRET_KEY;
  if (!cleSecrete) {
    throw new Error("SUPABASE_SECRET_KEY manquant dans .env.local (voir README).");
  }
  return createClient(url, cleSecrete, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
