import { afterAll, describe, expect, test } from "vitest";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles } from "./outils";

afterAll(fermerConnexion);

describe("Équipe du cabinet", () => {
  test("un collaborateur (affecté à A1) ne voit que A1 et n'a aucun accès à la gestion du cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const c = jeu.utilisateurs.gestionnaireA1;
      await commeUtilisateur(client, c);

      expect(await idsVisibles(client, "entreprises")).toEqual([jeu.entreprises.A1]);
      expect(await idsVisibles(client, "cabinets")).toEqual([]);
      expect(await idsVisibles(client, "membres_cabinet", "profil_id")).toEqual([]);
      expect((await client.query("select public.peut_gerer_cabinet($1) as ok", [jeu.cabinets.A])).rows[0].ok).toBe(false);

      // Ni se promouvoir administrateur, ni ajouter une entreprise, ni affecter quelqu'un
      expect(await estRefusee(client, "insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2)", [jeu.cabinets.A, c])).toBe(true);
      expect(await estRefusee(client, "insert into public.entreprises (cabinet_id, raison_sociale) values ($1, 'X')", [jeu.cabinets.A])).toBe(true);
      expect(
        await estRefusee(client, "insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'rh')", [
          jeu.entreprises.A2,
          jeu.utilisateurs.sansAffectation,
        ]),
      ).toBe(true);
      expect(
        await estRefusee(client, "insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'controleur')", [jeu.entreprises.A1, c]),
      ).toBe(true);
      const modif = await client.query("update public.cabinets set nom = 'Piraté' where id = $1", [jeu.cabinets.A]);
      expect(modif.rowCount).toBe(0);
      // Ni changer ses propres accès, ni retirer un administrateur
      expect((await client.query("update public.affectations set role = 'signataire' where profil_id = $1", [c])).rowCount).toBe(0);
      expect((await client.query("delete from public.affectations where profil_id = $1", [c])).rowCount).toBe(0);
      expect((await client.query("delete from public.membres_cabinet where cabinet_id = $1", [jeu.cabinets.A])).rowCount).toBe(0);
    }));

  test("l'administrateur affecte un collaborateur à plusieurs clients de son cabinet, jamais chez un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const sql = "insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'gestionnaire_paie')";
      // estRefusee annule toujours la requête : ici, on enregistre vraiment les affectations
      for (const e of [jeu.entreprises.A1, jeu.entreprises.A2]) {
        expect((await client.query(sql, [e, jeu.utilisateurs.sansAffectation])).rowCount).toBe(1);
      }
      expect(await estRefusee(client, sql, [jeu.entreprises.B1, jeu.utilisateurs.sansAffectation])).toBe(true);

      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);
      expect((await idsVisibles(client, "entreprises")).sort()).toEqual([jeu.entreprises.A1, jeu.entreprises.A2].sort());
      expect(await idsVisibles(client, "cabinets")).toEqual([]);
    }));

  test("un administrateur en ajoute un autre, peut le retirer, mais jamais le dernier", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const admin = jeu.utilisateurs.adminCabinetA;
      const nouveau = jeu.utilisateurs.sansAffectation;
      // Comptes activés (seul un administrateur activé compte pour la règle)
      await client.query("reset role");
      await client.query("update public.profils set active_le = now() where id = any($1)", [[admin, nouveau]]);
      await commeUtilisateur(client, admin);

      const retirer = (profil: string) => estRefusee(client, "delete from public.membres_cabinet where cabinet_id = $1 and profil_id = $2", [jeu.cabinets.A, profil]);
      // Seul administrateur : il ne peut pas se retirer
      expect(await retirer(admin)).toBe(true);

      await client.query("insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2)", [jeu.cabinets.A, nouveau]);
      // Le nouveau est bien administrateur
      await commeUtilisateur(client, nouveau);
      expect((await client.query("select public.peut_gerer_cabinet($1) as ok", [jeu.cabinets.A])).rows[0].ok).toBe(true);

      // Deux administrateurs : l'un peut retirer l'autre, puis le dernier reste
      await client.query("delete from public.membres_cabinet where cabinet_id = $1 and profil_id = $2", [jeu.cabinets.A, admin]);
      expect(await retirer(nouveau)).toBe(true);
    }));

  test("une seule requête ne peut pas retirer tous les administrateurs", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { adminCabinetA: admin, sansAffectation: autre } = jeu.utilisateurs;
      await client.query("reset role");
      await client.query("update public.profils set active_le = now() where id = any($1)", [[admin, autre]]);
      await client.query("insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2)", [jeu.cabinets.A, autre]);
      await commeUtilisateur(client, admin);
      expect(await estRefusee(client, "delete from public.membres_cabinet where cabinet_id = $1", [jeu.cabinets.A])).toBe(true);
    }));

  test("une invitation jamais activée ne compte pas comme administrateur restant", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { adminCabinetA: admin, sansAffectation: invite } = jeu.utilisateurs;
      await client.query("reset role");
      await client.query("update public.profils set active_le = now() where id = $1", [admin]);
      await client.query("update public.profils set active_le = null where id = $1", [invite]);
      await client.query("insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2)", [jeu.cabinets.A, invite]);
      await commeUtilisateur(client, admin);
      expect(await estRefusee(client, "delete from public.membres_cabinet where cabinet_id = $1 and profil_id = $2", [jeu.cabinets.A, admin])).toBe(true);
      // Retirer l'invitation en attente reste possible
      expect(await estRefusee(client, "delete from public.membres_cabinet where cabinet_id = $1 and profil_id = $2", [jeu.cabinets.A, invite])).toBe(false);
    }));

  test("l'administrateur plateforme peut toujours retirer le dernier administrateur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      const r = await client.query("delete from public.membres_cabinet where cabinet_id = $1", [jeu.cabinets.A]);
      expect(r.rowCount).toBe(1);
    }));

  test("un administrateur ne touche pas aux administrateurs d'un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, "insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2)", [jeu.cabinets.B, jeu.utilisateurs.adminCabinetA])).toBe(true);
      const retrait = await client.query("delete from public.membres_cabinet where cabinet_id = $1", [jeu.cabinets.B]);
      expect(retrait.rowCount).toBe(0);
    }));
});
