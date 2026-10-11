import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

async function creerPersonne(client: pg.Client, entrepriseId: string, role: string) {
  await client.query("reset role");
  const id = randomUUID();
  await client.query("insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [
    id,
    `${id.slice(0, 8)}@test.e-paie.local`,
  ]);
  await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, $3)", [entrepriseId, id, role]);
  return id;
}

// Période d'A1 avec un bulletin déposé par le gestionnaire, envoyée en validation (circuit par défaut).
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const e = jeu.entreprises.A1;
  const g = jeu.utilisateurs.gestionnaireA1;
  const s = (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, 'M1', 'N', 'P', '2024-01-01') returning id", [e])).rows[0].id;
  const p = (await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 10) returning id", [e])).rows[0].id;
  await client.query(
    `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par)
     values ($1, $2, $3, $4, 'b.pdf', 100, $5, $6)`,
    [e, p, s, `${e}/${p}/${s}-1.pdf`, "a".repeat(64), g],
  );
  const controleur = await creerPersonne(client, e, "controleur");
  const signataire = await creerPersonne(client, e, "signataire");
  const controleurB = await creerPersonne(client, jeu.entreprises.B1, "controleur");
  await commeUtilisateur(client, g);
  await client.query("select public.soumettre_periode($1)", [p]);
  return { periode: p as string, controleur, signataire, controleurB };
}

async function destinataires(client: pg.Client, periode: string) {
  await client.query("reset role");
  const { rows } = await client.query("select motif, profil_id from public.destinataires_alerte($1) order by profil_id", [periode]);
  return rows as { motif: string; profil_id: string }[];
}

async function mesActions(client: pg.Client, id: string) {
  await commeUtilisateur(client, id);
  const { rows } = await client.query("select periode_id, action from public.mes_actions_paie()");
  return rows as { periode_id: string; action: string }[];
}

describe("Alertes de validation", () => {
  test("seules les personnes qui peuvent valider l'étape en cours sont prévenues", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      expect(await destinataires(client, d.periode)).toEqual([{ motif: "a_valider", profil_id: d.controleur }]);

      await commeUtilisateur(client, d.controleur);
      await client.query("select public.valider_etape($1)", [d.periode]);
      expect(await destinataires(client, d.periode)).toEqual([{ motif: "a_valider", profil_id: d.signataire }]);
    }));

  test("le tableau de bord n'affiche l'action qu'à la bonne personne, jamais à une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      expect(await mesActions(client, d.controleur)).toEqual([{ periode_id: d.periode, action: "a_valider" }]);
      expect(await mesActions(client, d.signataire)).toEqual([]);
      expect(await mesActions(client, jeu.utilisateurs.gestionnaireA1)).toEqual([]); // émetteur
      expect(await mesActions(client, d.controleurB)).toEqual([]); // autre entreprise
      expect(await mesActions(client, jeu.utilisateurs.adminCabinetB)).toEqual([]);
    }));

  test("après un refus au brouillon : le gestionnaire est prévenu ; après approbation : les publieurs", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.controleur);
      await client.query("select public.refuser_etape($1, 'Il manque un bulletin')", [d.periode]);
      const apresRefus = await destinataires(client, d.periode);
      expect(apresRefus).toEqual([{ motif: "a_corriger", profil_id: jeu.utilisateurs.gestionnaireA1 }]);
      expect(await mesActions(client, jeu.utilisateurs.gestionnaireA1)).toEqual([{ periode_id: d.periode, action: "a_corriger" }]);

      // Nouvel envoi, contrôle, approbation
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      await client.query("select public.soumettre_periode($1)", [d.periode]);
      await commeUtilisateur(client, d.controleur);
      await client.query("select public.valider_etape($1)", [d.periode]);
      await commeUtilisateur(client, d.signataire);
      await client.query("select public.valider_etape($1)", [d.periode]);
      const publieurs = (await destinataires(client, d.periode)).map((r) => r.profil_id).sort();
      expect(publieurs).toEqual([jeu.utilisateurs.adminCabinetA, d.signataire].sort());
      expect(await mesActions(client, jeu.utilisateurs.adminCabinetB)).toEqual([]);
    }));

  test("la liste des destinataires (emails, numéros) est réservée au serveur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      for (const u of [d.controleur, jeu.utilisateurs.adminCabinetA, null]) {
        await commeUtilisateur(client, u);
        expect(await estRefusee(client, "select * from public.destinataires_alerte($1)", [d.periode])).toBe(true);
      }
    }));

  test("chacun ne peut modifier que son propre numéro WhatsApp, au bon format", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const g = jeu.utilisateurs.gestionnaireA1;
      await commeUtilisateur(client, g);
      expect((await client.query("update public.profils set whatsapp = '+24177000009' where id = $1", [g])).rowCount).toBe(1);
      expect((await client.query("update public.profils set whatsapp = '+24177000008' where id = $1", [jeu.utilisateurs.adminCabinetA])).rowCount).toBe(0);
      expect(await estRefusee(client, "update public.profils set whatsapp = 'pas un numero' where id = $1", [g])).toBe(true);
    }));

  test("personne ne peut valider l'étape : aucune alerte à d'autres personnes, seul l'avertissement de la page", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await client.query("reset role");
      await client.query("delete from public.affectations where profil_id = $1", [d.signataire]); // aucun signataire
      await commeUtilisateur(client, d.controleur);
      await client.query("select public.valider_etape($1)", [d.periode]);

      const { rows } = await (async () => {
        await client.query("reset role");
        return client.query("select motif, profil_id, commentaire from public.destinataires_alerte($1)", [d.periode]);
      })();
      expect(rows).toEqual([]);
      expect(await mesActions(client, jeu.utilisateurs.adminCabinetA)).toEqual([]);
      expect(await mesActions(client, jeu.utilisateurs.gestionnaireA1)).toEqual([]);
      expect(await mesActions(client, jeu.utilisateurs.adminCabinetB)).toEqual([]);
      await commeUtilisateur(client, d.controleur);
      expect((await client.query("select public.nb_validateurs_possibles($1) as n", [d.periode])).rows[0].n).toBe(0);
    }));
});
