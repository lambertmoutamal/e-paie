import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles } from "./outils";

afterAll(fermerConnexion);

async function ajouterDemande(client: pg.Client) {
  await client.query("reset role");
  const { rows } = await client.query(
    "insert into public.demandes_demo (nom, structure, type, email) values ('Awa', 'Cabinet X', 'cabinet', 'awa@x.ga') returning id",
  );
  return rows[0].id as string;
}

describe("Demandes de démo (coordonnées de prospects)", () => {
  test("seul l'administrateur plateforme les consulte", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const id = await ajouterDemande(client);

      for (const utilisateur of [jeu.utilisateurs.adminCabinetA, jeu.utilisateurs.gestionnaireA1, jeu.utilisateurs.sansAffectation]) {
        await commeUtilisateur(client, utilisateur);
        expect(await idsVisibles(client, "demandes_demo")).toEqual([]);
      }
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select * from public.demandes_demo")).toBe(true);

      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await idsVisibles(client, "demandes_demo")).toContain(id);
    }));

  test("personne ne peut en créer directement (seul le serveur, avec la limite anti-abus)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const sql = "insert into public.demandes_demo (nom, structure, type, email) values ('X', 'Y', 'autre', 'x@y.ga')";
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, sql)).toBe(true);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await estRefusee(client, sql)).toBe(true);
    }));

  test("l'admin plateforme peut seulement marquer une demande comme traitée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const id = await ajouterDemande(client);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect((await client.query("update public.demandes_demo set traitee_le = now() where id = $1", [id])).rowCount).toBe(1);
      expect(await estRefusee(client, "update public.demandes_demo set email = 'pirate@x.ga' where id = $1", [id])).toBe(true);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect((await client.query("update public.demandes_demo set traitee_le = null where id = $1", [id])).rowCount).toBe(0);
    }));
});
