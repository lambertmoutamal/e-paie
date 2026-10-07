import { afterAll, describe, expect, test } from "vitest";
import {
  commeUtilisateur,
  creerJeuDeDonnees,
  dansUneTransaction,
  estRefusee,
  fermerConnexion,
  idsVisibles,
} from "./outils";

afterAll(fermerConnexion);

describe("Isolation entre entreprises", () => {
  test("un gestionnaire ne voit que l'entreprise à laquelle il est affecté", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const visibles = await idsVisibles(client, "entreprises");
      expect(visibles).toContain(jeu.entreprises.A1);
      expect(visibles).not.toContain(jeu.entreprises.A2);
      expect(visibles).not.toContain(jeu.entreprises.B1);
    }));

  test("un gestionnaire ne voit pas les affectations d'une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const entreprisesDesAffectations = await idsVisibles(client, "affectations", "entreprise_id");
      expect(entreprisesDesAffectations).not.toContain(jeu.entreprises.B1);
    }));

  test("un gestionnaire ne voit pas le profil d'un utilisateur d'une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const profils = await idsVisibles(client, "profils");
      expect(profils).toContain(jeu.utilisateurs.gestionnaireA1);
      expect(profils).not.toContain(jeu.utilisateurs.gestionnaireB1);
      expect(profils).not.toContain(jeu.utilisateurs.adminCabinetB);
    }));

  test("un gestionnaire ne peut pas modifier une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const resultat = await client.query(
        "update public.entreprises set raison_sociale = 'Piratée' where id = $1",
        [jeu.entreprises.B1],
      );
      expect(resultat.rowCount).toBe(0);
    }));

  test("un gestionnaire ne peut pas s'affecter lui-même à une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const refus = await estRefusee(
        client,
        "insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'gestionnaire_paie')",
        [jeu.entreprises.B1, jeu.utilisateurs.gestionnaireA1],
      );
      expect(refus).toBe(true);
    }));

  test("un gestionnaire ne peut pas créer d'entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const refus = await estRefusee(
        client,
        "insert into public.entreprises (cabinet_id, raison_sociale) values ($1, 'Nouvelle')",
        [jeu.cabinets.A],
      );
      expect(refus).toBe(true);
    }));
});

describe("Utilisateurs sans droits", () => {
  test("un utilisateur sans affectation ne voit rien", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);

      expect(await idsVisibles(client, "entreprises")).toEqual([]);
      expect(await idsVisibles(client, "cabinets")).toEqual([]);
      expect(await idsVisibles(client, "affectations", "entreprise_id")).toEqual([]);
      expect(await idsVisibles(client, "profils")).toEqual([jeu.utilisateurs.sansAffectation]);
    }));

  test("un visiteur non connecté ne peut lire aucune table", () =>
    dansUneTransaction(async (client) => {
      await creerJeuDeDonnees(client);
      await commeUtilisateur(client, null);

      for (const table of ["profils", "cabinets", "membres_cabinet", "entreprises", "affectations"]) {
        expect(await estRefusee(client, `select * from public.${table}`), table).toBe(true);
      }
    }));

  test("personne ne peut se déclarer administrateur plateforme", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const refus = await estRefusee(
        client,
        "update public.profils set est_admin_plateforme = true where id = $1",
        [jeu.utilisateurs.gestionnaireA1],
      );
      expect(refus).toBe(true);
    }));
});

describe("Administrateur de cabinet", () => {
  test("voit les entreprises de son cabinet et pas celles d'un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      const visibles = await idsVisibles(client, "entreprises");
      expect(visibles).toEqual(expect.arrayContaining([jeu.entreprises.A1, jeu.entreprises.A2]));
      expect(visibles).not.toContain(jeu.entreprises.B1);
      expect(await idsVisibles(client, "cabinets")).toEqual([jeu.cabinets.A]);
    }));

  test("peut créer une entreprise dans son cabinet, mais pas dans un autre", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      const sql = "insert into public.entreprises (cabinet_id, raison_sociale) values ($1, 'Nouvelle')";
      expect(await estRefusee(client, sql, [jeu.cabinets.A])).toBe(false);
      expect(await estRefusee(client, sql, [jeu.cabinets.B])).toBe(true);
    }));

  test("ne peut pas déplacer une entreprise vers un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      const refus = await estRefusee(
        client,
        "update public.entreprises set cabinet_id = $1 where id = $2",
        [jeu.cabinets.B, jeu.entreprises.A1],
      );
      expect(refus).toBe(true);
    }));

  test("perd l'accès dès que l'entreprise quitte le cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      await client.query("update public.entreprises set cabinet_id = null where id = $1", [
        jeu.entreprises.A1,
      ]);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await idsVisibles(client, "entreprises")).not.toContain(jeu.entreprises.A1);
    }));
});

describe("Administrateur plateforme", () => {
  test("voit toutes les entreprises de tous les cabinets", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);

      const visibles = await idsVisibles(client, "entreprises");
      expect(visibles).toEqual(
        expect.arrayContaining([jeu.entreprises.A1, jeu.entreprises.A2, jeu.entreprises.B1]),
      );
    }));
});

describe("Filet de sécurité", () => {
  test("toutes les tables du schéma public ont la RLS activée", () =>
    dansUneTransaction(async (client) => {
      const { rows } = await client.query(`
        select c.relname as table
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      `);
      expect(rows.map((ligne) => ligne.table)).toEqual([]);
    }));

  test("toutes les tables du schéma public (sauf le journal) sont journalisées", () =>
    dansUneTransaction(async (client) => {
      const { rows } = await client.query(`
        select c.relname as table
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'journal_audit'
          and not exists (
            select 1 from pg_trigger t
            join pg_proc p on p.oid = t.tgfoid
            join pg_namespace pn on pn.oid = p.pronamespace
            where t.tgrelid = c.oid and pn.nspname = 'prive' and p.proname = 'journaliser'
          )
      `);
      expect(rows.map((ligne) => ligne.table)).toEqual([]);
    }));
});
