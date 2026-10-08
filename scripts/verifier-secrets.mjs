// Vérifie qu'aucune clé secrète ne se trouve dans les fichiers envoyés au navigateur.
// À lancer après « npm run build » : npm run verifier:secrets
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dossier = path.resolve(".next/static");
const VARIABLES_SECRETES = [
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "GENUKA_SECRET_KEY",
  "GENUKA_WEBHOOK_SECRET",
];
const motifs = ["sb_secret_", "service_role", ...VARIABLES_SECRETES];
const valeurs = VARIABLES_SECRETES.map((nom) => process.env[nom]).filter((v) => v && v.length >= 8);
motifs.push(...valeurs);

async function* fichiers(rep) {
  for (const entree of await readdir(rep, { withFileTypes: true })) {
    const chemin = path.join(rep, entree.name);
    if (entree.isDirectory()) yield* fichiers(chemin);
    else yield chemin;
  }
}

let nombre = 0;
const fuites = [];
for await (const fichier of fichiers(dossier)) {
  nombre++;
  const contenu = await readFile(fichier, "utf8");
  for (const motif of motifs) {
    if (contenu.includes(motif)) {
      const description = valeurs.includes(motif) ? "la valeur d'une clé secrète" : `« ${motif} »`;
      fuites.push(`${path.relative(".", fichier)} contient ${description}`);
    }
  }
}

if (fuites.length) {
  console.error("✗ Fuite détectée :\n" + fuites.join("\n"));
  process.exit(1);
}
console.log(`✓ ${nombre} fichiers envoyés au navigateur vérifiés : aucun secret.`);
