// Adresse et clé publique du projet Supabase, lues dans .env.local.
// La clé « publishable » peut être vue par le navigateur : la sécurité
// repose sur les règles RLS de la base, pas sur le secret de cette clé.
export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquant dans .env.local (voir README).",
    );
  }
  return { url, cle };
}
