import { afterAll, describe, expect, test } from "vitest";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles } from "./outils";

afterAll(fermerConnexion);

const CREER = "insert into public.entreprises (cabinet_id, raison_sociale, interne_cabinet) values ($1, 'Mon cabinet', true) returning id";

describe("« Mon cabinet » : entreprise interne du cabinet", () => {
  test("un admin cabinet crée l'espace de son cabinet, une seule fois, et jamais pour un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, CREER, [jeu.cabinets.B])).toBe(true);
      const id = (await client.query(CREER, [jeu.cabinets.A])).rows[0].id;
      expect(await estRefusee(client, CREER, [jeu.cabinets.A])).toBe(true);
      expect(await idsVisibles(client, "entreprises")).toContain(id);
    }));

  test("ni un gestionnaire ni une personne sans affectation ne peuvent le créer", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      for (const utilisateur of [jeu.utilisateurs.gestionnaireA1, jeu.utilisateurs.sansAffectation]) {
        await commeUtilisateur(client, utilisateur);
        expect(await estRefusee(client, CREER, [jeu.cabinets.A])).toBe(true);
      }
    }));

  test("une entreprise interne a toujours un cabinet", () =>
    dansUneTransaction(async (client) => {
      await creerJeuDeDonnees(client);
      await client.query("reset role");
      expect(await estRefusee(client, "insert into public.entreprises (raison_sociale, interne_cabinet) values ('Sans cabinet', true)")).toBe(true);
    }));

  test("l'autre cabinet ne voit pas l'espace interne, et le marquage ne se change pas", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const id = (await client.query(CREER, [jeu.cabinets.A])).rows[0].id;

      expect(await estRefusee(client, "update public.entreprises set interne_cabinet = false where id = $1", [id])).toBe(true);
      // Une entreprise cliente ne peut pas devenir « Mon cabinet » (ce qui contournerait la limite d'une par cabinet)
      expect(await estRefusee(client, "update public.entreprises set interne_cabinet = true where id = $1", [jeu.entreprises.A1])).toBe(true);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await idsVisibles(client, "entreprises")).not.toContain(id);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect(await idsVisibles(client, "entreprises")).not.toContain(id);
    }));

  test("le cabinet gère les salariés de son espace interne", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const id = (await client.query(CREER, [jeu.cabinets.A])).rows[0].id;
      const ajout = "insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, 'INT-1', 'N', 'P', '2024-01-01')";
      expect(await estRefusee(client, ajout, [id])).toBe(false);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await estRefusee(client, ajout, [id])).toBe(true);
    }));
});
