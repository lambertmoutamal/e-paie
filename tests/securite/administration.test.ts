import { afterAll, describe, expect, test } from "vitest";
import {
  commeUtilisateur,
  creerJeuDeDonnees,
  dansUneTransaction,
  estRefusee,
  fermerConnexion,
} from "./outils";

afterAll(fermerConnexion);

async function droit(client: import("pg").Client, sql: string, params: unknown[] = []) {
  const { rows } = await client.query(`select ${sql} as resultat`, params);
  return rows[0].resultat as boolean;
}

describe("Questions de droits posées par l'application", () => {
  test("peut_gerer_entreprise : vrai seulement pour l'admin du cabinet et l'admin plateforme", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const q = "public.peut_gerer_entreprise($1)";

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await droit(client, q, [jeu.entreprises.A1])).toBe(true);
      expect(await droit(client, q, [jeu.entreprises.B1])).toBe(false);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await droit(client, q, [jeu.entreprises.A1])).toBe(false);

      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await droit(client, q, [jeu.entreprises.B1])).toBe(true);
    }));

  test("peut_gerer_cabinet et est_admin_plateforme répondent pour l'appelant uniquement", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await droit(client, "public.peut_gerer_cabinet($1)", [jeu.cabinets.A])).toBe(true);
      expect(await droit(client, "public.peut_gerer_cabinet($1)", [jeu.cabinets.B])).toBe(false);
      expect(await droit(client, "public.est_admin_plateforme()")).toBe(false);

      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await droit(client, "public.est_admin_plateforme()")).toBe(true);
    }));

  test("un visiteur non connecté ne peut pas poser ces questions", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select public.est_admin_plateforme()")).toBe(true);
      expect(await estRefusee(client, "select public.peut_gerer_entreprise($1)", [jeu.entreprises.A1])).toBe(true);
    }));
});

describe("Profil", () => {
  test("chacun peut modifier son propre nom", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const r = await client.query("update public.profils set nom_complet = 'Awa Ndong' where id = $1", [
        jeu.utilisateurs.gestionnaireA1,
      ]);
      expect(r.rowCount).toBe(1);
    }));

  test("personne ne peut modifier le nom d'un autre", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const r = await client.query("update public.profils set nom_complet = 'Piraté' where id = $1", [
        jeu.utilisateurs.gestionnaireA1,
      ]);
      expect(r.rowCount).toBe(0);
    }));

  test("personne ne peut changer son email ou son téléphone directement", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(
        await estRefusee(client, "update public.profils set email = 'autre@exemple.ga' where id = $1", [
          jeu.utilisateurs.gestionnaireA1,
        ]),
      ).toBe(true);
      expect(
        await estRefusee(client, "update public.profils set telephone = '+24106000000' where id = $1", [
          jeu.utilisateurs.gestionnaireA1,
        ]),
      ).toBe(true);
    }));
});

describe("Invitations et emails", () => {
  test("la limite d'envoi bloque un second email dans le délai", () =>
    dansUneTransaction(async (client) => {
      await client.query("set local role service_role");
      const cle = `test:${Date.now()}`;
      expect(await droit(client, "public.reserver_envoi_email($1, 300)", [cle])).toBe(true);
      expect(await droit(client, "public.reserver_envoi_email($1, 300)", [cle])).toBe(false);
    }));

  test("un utilisateur connecté ou un visiteur ne peut pas utiliser la limite d'envoi", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await estRefusee(client, "select public.reserver_envoi_email('x', 1)")).toBe(true);
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select public.reserver_envoi_email('x', 1)")).toBe(true);
    }));

  test("un compte invité est « en attente » jusqu'à sa première connexion", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const id = jeu.utilisateurs.gestionnaireA1;
      const lire = async () =>
        (await client.query("select active_le from public.profils where id = $1", [id])).rows[0].active_le;

      expect(await lire()).toBeNull();
      await client.query("update auth.users set last_sign_in_at = now() where id = $1", [id]);
      expect(await lire()).not.toBeNull();
    }));

  test("personne ne peut se déclarer « activé » lui-même", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(
        await estRefusee(client, "update public.profils set active_le = now() where id = $1", [
          jeu.utilisateurs.gestionnaireA1,
        ]),
      ).toBe(true);
    }));
});

describe("Gestion des membres et des rôles", () => {
  test("un admin cabinet ne peut pas ajouter d'administrateur à un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(
        await estRefusee(client, "insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2)", [
          jeu.cabinets.B,
          jeu.utilisateurs.adminCabinetA,
        ]),
      ).toBe(true);
    }));

  test("un admin cabinet affecte des personnes dans ses entreprises, pas dans celles des autres", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const sql = "insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'rh')";
      expect(await estRefusee(client, sql, [jeu.entreprises.A2, jeu.utilisateurs.sansAffectation])).toBe(false);
      expect(await estRefusee(client, sql, [jeu.entreprises.B1, jeu.utilisateurs.sansAffectation])).toBe(true);
    }));

  test("retirer un accès : possible pour l'admin du cabinet, impossible ailleurs", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const sql = "update public.affectations set actif = false where entreprise_id = $1";

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect((await client.query(sql, [jeu.entreprises.A1])).rowCount).toBe(1);
      expect((await client.query(sql, [jeu.entreprises.B1])).rowCount).toBe(0);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect((await client.query(sql, [jeu.entreprises.B1])).rowCount).toBe(0);
    }));

  test("une personne dont l'accès est retiré ne voit plus l'entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      await client.query("update public.affectations set actif = false where entreprise_id = $1", [
        jeu.entreprises.A1,
      ]);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const { rows } = await client.query("select id from public.entreprises");
      expect(rows).toEqual([]);
    }));
});
