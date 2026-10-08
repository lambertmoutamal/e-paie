import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import {
  commeUtilisateur,
  creerJeuDeDonnees,
  dansUneTransaction,
  estRefusee,
  fermerConnexion,
  idsVisibles,
  type JeuDeDonnees,
} from "./outils";

afterAll(fermerConnexion);

// Un salarié dans A1 et un dans B1 (créés par le propriétaire de la base).
async function ajouterSalaries(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const { rows } = await client.query(
    `insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, numero_compte)
     values ($1, 'A-001', 'NDONG', 'Awa', '2024-01-15', 'GA21 0001 0002'),
            ($2, 'B-001', 'MBA', 'Paul', '2023-06-01', 'GA21 0009 0009')
     returning id, entreprise_id`,
    [jeu.entreprises.A1, jeu.entreprises.B1],
  );
  const parEntreprise = Object.fromEntries(rows.map((r) => [r.entreprise_id, r.id]));
  return { salarieA1: parEntreprise[jeu.entreprises.A1] as string, salarieB1: parEntreprise[jeu.entreprises.B1] as string };
}

async function affecter(client: pg.Client, entrepriseId: string, profilId: string, role: string) {
  await client.query("reset role");
  await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, $3)", [
    entrepriseId,
    profilId,
    role,
  ]);
}

const INSERTION =
  "insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, $2, 'TEST', 'Test', '2025-01-01')";

describe("Isolation des salariés entre entreprises", () => {
  test("un gestionnaire ne voit que les salariés de son entreprise (coordonnées bancaires comprises)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1, salarieB1 } = await ajouterSalaries(client, jeu);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const visibles = await idsVisibles(client, "salaries");
      expect(visibles).toEqual([salarieA1]);
      expect(visibles).not.toContain(salarieB1);
      const { rows } = await client.query("select numero_compte from public.salaries where id = $1", [salarieB1]);
      expect(rows).toEqual([]);
    }));

  test("un gestionnaire ne peut ni créer ni modifier un salarié d'une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieB1 } = await ajouterSalaries(client, jeu);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.B1, "X-1"])).toBe(true);
      const r = await client.query("update public.salaries set nom = 'PIRATE' where id = $1", [salarieB1]);
      expect(r.rowCount).toBe(0);
    }));

  test("impossible de déplacer un salarié vers une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1 } = await ajouterSalaries(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(
        await estRefusee(client, "update public.salaries set entreprise_id = $1 where id = $2", [jeu.entreprises.A2, salarieA1]),
      ).toBe(true);
    }));

  test("personne ne peut supprimer un salarié (l'historique est conservé)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1 } = await ajouterSalaries(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await estRefusee(client, "delete from public.salaries where id = $1", [salarieA1])).toBe(true);
    }));
});

describe("Droits selon le rôle", () => {
  test("gestionnaire de paie et RH peuvent créer et modifier", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await affecter(client, jeu.entreprises.A1, jeu.utilisateurs.sansAffectation, "rh");

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.A1, "G-1"])).toBe(false);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.A1, "R-1"])).toBe(false);
    }));

  test("contrôleur et signataire consultent mais ne modifient pas", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1 } = await ajouterSalaries(client, jeu);
      await affecter(client, jeu.entreprises.A1, jeu.utilisateurs.sansAffectation, "controleur");

      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);
      expect(await idsVisibles(client, "salaries")).toEqual([salarieA1]);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.A1, "C-1"])).toBe(true);
      expect((await client.query("update public.salaries set nom = 'X' where id = $1", [salarieA1])).rowCount).toBe(0);
      expect((await client.query("select public.peut_gerer_salaries($1) as r", [jeu.entreprises.A1])).rows[0].r).toBe(false);
    }));

  test("un matricule est unique dans une entreprise, mais peut exister dans une autre", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await ajouterSalaries(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.A1, "A-001"])).toBe(true);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.A2, "A-001"])).toBe(false);
    }));

  test("abonnement en lecture seule : on consulte les salariés, on ne modifie plus", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1 } = await ajouterSalaries(client, jeu);
      await client.query(
        `insert into public.abonnements (cabinet_id, formule_id, statut, debut, fin)
         select $1, id, 'essai', now() - interval '60 days', now() - interval '5 days' from public.formules where code = 'essai'`,
        [jeu.cabinets.A],
      );
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "salaries")).toEqual([salarieA1]);
      expect(await estRefusee(client, INSERTION, [jeu.entreprises.A1, "L-1"])).toBe(true);
    }));
});

describe("Rapports d'import", () => {
  test("un rapport d'import est signé par son auteur et invisible des autres entreprises", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const rapport =
        "insert into public.imports_salaries (entreprise_id, nom_fichier, nb_lignes, nb_crees, nb_mis_a_jour, auteur_id) values ($1, 'f.xlsx', 1, 1, 0, $2)";

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      // Impossible de signer au nom de quelqu'un d'autre
      expect(await estRefusee(client, rapport, [jeu.entreprises.A1, jeu.utilisateurs.adminCabinetA])).toBe(true);
      expect(await estRefusee(client, rapport, [jeu.entreprises.A1, jeu.utilisateurs.gestionnaireA1])).toBe(false);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect(await idsVisibles(client, "imports_salaries")).toEqual([]);
    }));
});
