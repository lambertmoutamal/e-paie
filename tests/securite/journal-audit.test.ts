import { afterAll, describe, expect, test } from "vitest";
import {
  commeUtilisateur,
  creerJeuDeDonnees,
  dansUneTransaction,
  estRefusee,
  fermerConnexion,
} from "./outils";

afterAll(fermerConnexion);

describe("Enregistrement automatique", () => {
  test("une création d'entreprise est tracée avec son auteur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      const { rows: creee } = await client.query(
        "insert into public.entreprises (cabinet_id, raison_sociale) values ($1, 'Nouvelle SARL') returning id",
        [jeu.cabinets.A],
      );
      const { rows } = await client.query(
        "select * from public.journal_audit where table_nom = 'entreprises' and enregistrement_id = $1",
        [creee[0].id],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe("INSERT");
      expect(rows[0].auteur_id).toBe(jeu.utilisateurs.adminCabinetA);
      expect(rows[0].entreprise_id).toBe(creee[0].id);
      expect(rows[0].nouvelle_valeur.raison_sociale).toBe("Nouvelle SARL");
    }));

  test("une modification garde l'ancienne et la nouvelle valeur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      await client.query("update public.entreprises set raison_sociale = 'A1 Renommée' where id = $1", [
        jeu.entreprises.A1,
      ]);
      const { rows } = await client.query(
        "select * from public.journal_audit where action = 'UPDATE' and enregistrement_id = $1",
        [jeu.entreprises.A1],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].ancienne_valeur.raison_sociale).toBe("Entreprise A1");
      expect(rows[0].nouvelle_valeur.raison_sociale).toBe("A1 Renommée");
    }));
});

describe("Journal non modifiable", () => {
  test("un utilisateur connecté ne peut ni écrire, ni modifier, ni supprimer", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);

      expect(
        await estRefusee(
          client,
          "insert into public.journal_audit (horodatage, action, table_nom, hash) values (now(), 'FAUX', 'x', 'x')",
        ),
      ).toBe(true);
      expect(await estRefusee(client, "update public.journal_audit set action = 'FAUX'")).toBe(true);
      expect(await estRefusee(client, "delete from public.journal_audit")).toBe(true);
    }));

  test("même l'administrateur de la base ne peut pas modifier ou vider le journal", () =>
    dansUneTransaction(async (client) => {
      await creerJeuDeDonnees(client);
      // Pas de commeUtilisateur : on reste le propriétaire de la base.
      expect(await estRefusee(client, "update public.journal_audit set action = 'FAUX'")).toBe(true);
      expect(await estRefusee(client, "delete from public.journal_audit")).toBe(true);
      expect(await estRefusee(client, "truncate public.journal_audit")).toBe(true);
    }));

  test("la chaîne d'empreintes est intacte", () =>
    dansUneTransaction(async (client) => {
      await creerJeuDeDonnees(client);
      const { rows } = await client.query("select prive.verifier_journal_audit() as ligne_alteree");
      expect(rows[0].ligne_alteree).toBeNull();
    }));

  test("une falsification est détectée par la vérification", () =>
    dansUneTransaction(async (client) => {
      await creerJeuDeDonnees(client);
      // On simule un attaquant qui aurait réussi à désactiver la protection.
      await client.query("alter table public.journal_audit disable trigger journal_audit_non_modifiable");
      const { rows: derniere } = await client.query(
        "update public.journal_audit set action = 'FALSIFIÉ' where id = (select max(id) from public.journal_audit) returning id",
      );
      const { rows } = await client.query("select prive.verifier_journal_audit() as ligne_alteree");
      expect(rows[0].ligne_alteree).toBe(derniere[0].id);
    }));
});

describe("Lecture du journal", () => {
  test("un admin cabinet voit l'historique de ses entreprises, pas celui des autres", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      const { rows } = await client.query(
        "select distinct entreprise_id from public.journal_audit where entreprise_id is not null",
      );
      const entreprises = rows.map((l) => l.entreprise_id);
      expect(entreprises).toEqual(expect.arrayContaining([jeu.entreprises.A1, jeu.entreprises.A2]));
      expect(entreprises).not.toContain(jeu.entreprises.B1);
    }));

  test("un gestionnaire de paie ne voit pas le journal", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);

      const { rows } = await client.query("select count(*)::int as n from public.journal_audit");
      expect(rows[0].n).toBe(0);
    }));

  test("un visiteur non connecté ne peut pas lire le journal", () =>
    dansUneTransaction(async (client) => {
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select * from public.journal_audit")).toBe(true);
    }));
});
