import pg from "pg";

// Connexion directe à PostgreSQL (migrations et tests de sécurité uniquement).
// L'application, elle, passera toujours par Supabase et ses règles RLS.
export function nouvelleConnexion() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL est vide. Copiez .env.example en .env.local et renseignez-la (voir README).",
    );
  }
  return new pg.Client({ connectionString: url });
}
