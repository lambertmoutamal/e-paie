// Donne le rôle d'administrateur plateforme à un compte existant.
// Usage : npm run admin:promouvoir -- adresse@email.com
// Le compte doit d'abord être créé dans Supabase (Authentication > Users > Add user).
import { nouvelleConnexion } from "./base-de-donnees.mjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Indiquez l'email : npm run admin:promouvoir -- adresse@email.com");
  process.exit(1);
}

const client = nouvelleConnexion();
await client.connect();
try {
  const { rowCount } = await client.query(
    "update public.profils set est_admin_plateforme = true where lower(email) = $1",
    [email],
  );
  if (rowCount === 0) {
    console.error(`Aucun compte trouvé pour ${email}. Créez-le d'abord dans Supabase.`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${email} est maintenant administrateur plateforme.`);
  }
} finally {
  await client.end();
}
