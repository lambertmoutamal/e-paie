// Remise à zéro de la base : supprime TOUTES les entreprises (et tout ce qui en dépend :
// salariés, contrats, paie, bulletins…), les cabinets, tous les fichiers stockés et tous les
// comptes, SAUF les administrateurs plateforme. Le journal d'audit est conservé.
//
// Une sauvegarde complète (données + fichiers) est d'abord écrite dans le dossier « sauvegardes »
// (jamais envoyé sur GitHub). Rien n'est supprimé si la sauvegarde échoue.
//
// Usage (définitif !) :  npm run base:remise-a-zero -- --je-confirme
// Essai sans rien supprimer :  npm run base:remise-a-zero -- --sauvegarde-seulement
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { nouvelleConnexion } from "./base-de-donnees.mjs";

const sauvegardeSeulement = process.argv.includes("--sauvegarde-seulement");
if (!sauvegardeSeulement && !process.argv.includes("--je-confirme")) {
  console.error("Opération définitive. Relancez avec : npm run base:remise-a-zero -- --je-confirme");
  process.exit(1);
}

// Tables vidées (directement ou par suppression en cascade), sauvegardées avant.
const TABLES = [
  "entreprises", "cabinets", "membres_cabinet", "affectations", "salaries", "contrats", "documents_salarie",
  "periodes_paie", "bulletins", "validations_periode", "etapes_circuit", "resultats_paie", "avis_bulletins",
  "emargements_bulletins", "demandes_absence", "soldes_conges_initiaux", "parametres_conges", "types_absence",
  "jours_feries", "reclamations", "messages_reclamation", "imports_salaries", "modeles_contrat", "abonnements",
  "paiements", "inscriptions", "demandes_entreprise", "demandes_demo", "profils",
];

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const client = nouvelleConnexion();
await client.connect();

const horodatage = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const dossier = path.resolve("sauvegardes", `remise-a-zero-${horodatage}`);

// Tous les fichiers d'un compartiment (en parcourant les sous-dossiers)
async function listerFichiers(compartiment, prefixe = "") {
  const resultat = [];
  for (let page = 0; ; page++) {
    const { data, error } = await admin.storage.from(compartiment).list(prefixe, { limit: 1000, offset: page * 1000 });
    if (error) throw new Error(`Lecture du stockage « ${compartiment} » impossible : ${error.message}`);
    for (const element of data) {
      const chemin = prefixe ? `${prefixe}/${element.name}` : element.name;
      if (element.id === null) resultat.push(...(await listerFichiers(compartiment, chemin)));
      else resultat.push(chemin);
    }
    if (data.length < 1000) return resultat;
  }
}

try {
  // 1. Sauvegarde
  await mkdir(dossier, { recursive: true });
  const donnees = {};
  for (const table of TABLES) {
    donnees[table] = (await client.query(`select * from public.${table}`)).rows;
  }
  await writeFile(path.join(dossier, "donnees.json"), JSON.stringify(donnees, null, 2));

  const { data: compartiments, error: erreurCompartiments } = await admin.storage.listBuckets();
  if (erreurCompartiments) throw new Error(`Liste du stockage impossible : ${erreurCompartiments.message}`);
  const fichiers = {};
  for (const { id } of compartiments) {
    fichiers[id] = await listerFichiers(id);
    for (const chemin of fichiers[id]) {
      const { data, error } = await admin.storage.from(id).download(chemin);
      if (error) throw new Error(`Sauvegarde du fichier ${id}/${chemin} impossible : ${error.message}`);
      const cible = path.join(dossier, "fichiers", id, chemin);
      await mkdir(path.dirname(cible), { recursive: true });
      await writeFile(cible, Buffer.from(await data.arrayBuffer()));
    }
  }
  const nbFichiers = Object.values(fichiers).reduce((n, liste) => n + liste.length, 0);
  console.log(`1. Sauvegarde écrite dans ${path.relative(process.cwd(), dossier)} (${nbFichiers} fichier(s)).`);
  if (sauvegardeSeulement) {
    console.log("Mode essai : rien n'a été supprimé.");
    process.exit(0);
  }

  // 2. Fichiers stockés
  for (const [id, liste] of Object.entries(fichiers)) {
    for (let i = 0; i < liste.length; i += 100) {
      const { error } = await admin.storage.from(id).remove(liste.slice(i, i + 100));
      if (error) throw new Error(`Suppression des fichiers « ${id} » impossible : ${error.message}`);
    }
  }
  console.log(`2. ${nbFichiers} fichier(s) supprimé(s) du stockage.`);

  // 3. Données (en une seule fois : tout ou rien)
  await client.query("begin");
  await client.query("delete from public.entreprises");
  await client.query("delete from public.cabinets");
  await client.query("delete from public.demandes_demo");
  await client.query("delete from public.inscriptions");
  await client.query("delete from prive.envois_email");
  await client.query("commit");
  console.log("3. Entreprises, cabinets et tout ce qui en dépend supprimés.");

  // 4. Comptes (sauf administrateurs plateforme)
  const { rows: comptes } = await client.query(
    `select u.id from auth.users u left join public.profils p on p.id = u.id
      where coalesce(p.est_admin_plateforme, false) = false`,
  );
  for (const { id } of comptes) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`Suppression d'un compte impossible : ${error.message}`);
  }
  console.log(`4. ${comptes.length} compte(s) supprimé(s) ; administrateur(s) conservé(s).`);

  // Bilan
  const bilan = await client.query(`select
      (select count(*) from public.entreprises)::int entreprises, (select count(*) from public.cabinets)::int cabinets,
      (select count(*) from public.salaries)::int salaries, (select count(*) from public.bulletins)::int bulletins,
      (select count(*) from auth.users)::int comptes`);
  console.log("Bilan :", bilan.rows[0]);
} catch (erreur) {
  await client.query("rollback").catch(() => {});
  console.error("ARRÊT :", erreur.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
