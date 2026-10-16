import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

// Une demande pour le cabinet A, une pour le cabinet B (déposées par le serveur).
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const demande = async (cabinet: string, nom: string) =>
    (
      await client.query(
        `insert into public.demandes_entreprise (cabinet_id, raison_sociale, numero_cnamgs, nb_salaries, contact_nom, contact_email)
         values ($1, $2, 'CN-1', 12, 'Contact', 'contact@exemple.ga') returning id`,
        [cabinet, nom],
      )
    ).rows[0].id as string;
  return { A: await demande(jeu.cabinets.A, "Client de A"), B: await demande(jeu.cabinets.B, "Client de B") };
}

describe("Demandes de prise en charge par un cabinet", () => {
  test("chaque cabinet ne voit que ses demandes ; ni visiteur, ni entreprise n'y ont accès", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await idsVisibles(client, "demandes_entreprise")).toEqual([d.A]);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await idsVisibles(client, "demandes_entreprise")).toEqual([d.B]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "demandes_entreprise")).toEqual([]);
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select id from public.demandes_entreprise")).toBe(true);
    }));

  test("aucune écriture directe : pas de fausse demande, pas de changement de statut", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, null);
      expect(
        await estRefusee(
          client,
          "insert into public.demandes_entreprise (cabinet_id, raison_sociale, nb_salaries, contact_nom, contact_email) values ($1, 'X', 1, 'X', 'x@x.ga')",
          [jeu.cabinets.A],
        ),
      ).toBe(true);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, "update public.demandes_entreprise set statut = 'acceptee' where id = $1", [d.A])).toBe(true);
    }));

  test("un cabinet ne peut ni accepter ni refuser la demande adressée à un autre", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await estRefusee(client, "select public.accepter_demande_entreprise($1)", [d.A])).toBe(true);
      expect(await estRefusee(client, "select public.refuser_demande_entreprise($1)", [d.A])).toBe(true);
      expect(await estRefusee(client, "select public.noter_demande_informations($1)", [d.A])).toBe(true);
    }));

  test("acceptation : l'entreprise est créée chez le bon cabinet, une seule fois", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const { rows } = await client.query("select public.accepter_demande_entreprise($1) as id", [d.A]);
      const entreprise = (await client.query("select cabinet_id, mode, numero_cnamgs, raison_sociale from public.entreprises where id = $1", [rows[0].id])).rows[0];
      expect(entreprise).toEqual({ cabinet_id: jeu.cabinets.A, mode: "cabinet", numero_cnamgs: "CN-1", raison_sociale: "Client de A" });
      expect(await estRefusee(client, "select public.accepter_demande_entreprise($1)", [d.A])).toBe(true);

      // Le cabinet B ne voit pas cette nouvelle entreprise
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect((await client.query("select id from public.entreprises where id = $1", [rows[0].id])).rowCount).toBe(0);
    }));
});
