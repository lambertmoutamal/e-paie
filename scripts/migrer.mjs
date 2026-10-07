// Applique, dans l'ordre, les fichiers de supabase/migrations qui ne l'ont pas encore été.
// Chaque fichier est appliqué en entier ou pas du tout (transaction).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { nouvelleConnexion } from "./base-de-donnees.mjs";

const dossier = path.resolve("supabase/migrations");

const client = nouvelleConnexion();
await client.connect();

try {
  await client.query(`
    create schema if not exists outils;
    create table if not exists outils.migrations (
      nom text primary key,
      appliquee_le timestamptz not null default now()
    );
  `);

  const { rows } = await client.query("select nom from outils.migrations");
  const dejaAppliquees = new Set(rows.map((ligne) => ligne.nom));
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".sql")).sort();

  let nombre = 0;
  for (const fichier of fichiers) {
    if (dejaAppliquees.has(fichier)) continue;
    const sql = await readFile(path.join(dossier, fichier), "utf8");
    process.stdout.write(`→ ${fichier} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into outils.migrations (nom) values ($1)", [fichier]);
      await client.query("commit");
      console.log("OK");
      nombre++;
    } catch (erreur) {
      await client.query("rollback");
      console.log("ÉCHEC");
      throw erreur;
    }
  }
  console.log(nombre === 0 ? "Base déjà à jour." : `${nombre} migration(s) appliquée(s).`);
} finally {
  await client.end();
}
