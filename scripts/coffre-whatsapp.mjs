// Range les réglages WhatsApp (Meta) de .env.local dans le coffre-fort de Supabase (Vault),
// où la fonction d'envoi du code de connexion des salariés les lit.
// À relancer après chaque nouveau jeton Meta :  npm run whatsapp:coffre
// Aucune valeur secrète n'est affichée.
import pg from "pg";

const REGLAGES = {
  meta_whatsapp_jeton: process.env.META_WHATSAPP_JETON,
  meta_whatsapp_numero_id: process.env.META_WHATSAPP_NUMERO_ID,
  meta_whatsapp_version: process.env.META_WHATSAPP_VERSION || "v25.0",
  meta_whatsapp_langue: process.env.META_WHATSAPP_LANGUE || "fr",
  meta_whatsapp_modele_code: process.env.META_WHATSAPP_MODELE_CODE || "",
};

if (!REGLAGES.meta_whatsapp_jeton || !REGLAGES.meta_whatsapp_numero_id) {
  console.error("META_WHATSAPP_JETON et META_WHATSAPP_NUMERO_ID doivent être renseignés dans .env.local.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const [nom, valeur] of Object.entries(REGLAGES)) {
    const { rows } = await client.query("select id from vault.secrets where name = $1", [nom]);
    if (rows.length) await client.query("select vault.update_secret($1, $2)", [rows[0].id, valeur]);
    else await client.query("select vault.create_secret($1, $2)", [valeur, nom]);
    console.log(`✓ ${nom} ${valeur ? "rangé" : "(vide)"}`);
  }
  console.log("Réglages WhatsApp à jour dans le coffre-fort de Supabase.");
} finally {
  await client.end();
}
