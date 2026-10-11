import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

// Un modèle propre à A1 et un à B1, un contrat en brouillon rédigé pour un salarié d'A1.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const modele = async (e: string) =>
    (await client.query("insert into public.modeles_contrat (entreprise_id, nom, categorie, contenu) values ($1, 'Mon CDI', 'contrat', '<p>x</p>') returning id", [e])).rows[0].id as string;
  const modeleA = await modele(jeu.entreprises.A1);
  const modeleB = await modele(jeu.entreprises.B1);
  const salarie = (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, 'M1', 'N', 'P', '2024-01-01') returning id", [jeu.entreprises.A1])).rows[0].id;
  const contrat = (
    await client.query(
      "insert into public.contrats (entreprise_id, salarie_id, type_contrat, date_debut, statut, contenu) values ($1, $2, 'cdi', '2026-11-01', 'brouillon', '<p>Brouillon</p>') returning id",
      [jeu.entreprises.A1, salarie],
    )
  ).rows[0].id as string;
  const standard = (await client.query("select id from public.modeles_contrat where entreprise_id is null limit 1")).rows[0].id as string;
  return { modeleA, modeleB, contrat, standard };
}

describe("Modèles de contrat", () => {
  test("chaque entreprise ne voit que ses modèles et les modèles standard", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const visibles = await idsVisibles(client, "modeles_contrat");
      expect(visibles).toContain(d.modeleA);
      expect(visibles).toContain(d.standard);
      expect(visibles).not.toContain(d.modeleB);
    }));

  test("les modèles standard sont en lecture seule, même pour un administrateur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      for (const u of [jeu.utilisateurs.adminCabinetA, jeu.utilisateurs.gestionnaireA1]) {
        await commeUtilisateur(client, u);
        expect((await client.query("update public.modeles_contrat set contenu = '<p>piège</p>' where id = $1", [d.standard])).rowCount).toBe(0);
        expect((await client.query("delete from public.modeles_contrat where id = $1", [d.standard])).rowCount).toBe(0);
        expect(await estRefusee(client, "insert into public.modeles_contrat (entreprise_id, nom, categorie, contenu) values (null, 'Faux standard', 'contrat', '<p></p>')")).toBe(true);
      }
    }));

  test("impossible de créer ou modifier un modèle d'une autre entreprise ; le contrôleur ne modifie rien", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, "insert into public.modeles_contrat (entreprise_id, nom, categorie, contenu) values ($1, 'Piège', 'contrat', '<p></p>')", [jeu.entreprises.B1])).toBe(true);
      expect((await client.query("update public.modeles_contrat set nom = 'Piège' where id = $1", [d.modeleB])).rowCount).toBe(0);

      await client.query("reset role");
      await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'controleur')", [jeu.entreprises.A1, jeu.utilisateurs.sansAffectation]);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);
      expect((await client.query("update public.modeles_contrat set nom = 'Piège' where id = $1", [d.modeleA])).rowCount).toBe(0);
    }));
});

describe("Document du contrat", () => {
  test("un document signé (figé) ne peut plus être modifié ni rouvert", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect((await client.query("update public.contrats set contenu = '<p>Modifié</p>' where id = $1", [d.contrat])).rowCount).toBe(1);
      await client.query("update public.contrats set document_fige = true where id = $1", [d.contrat]);
      expect(await estRefusee(client, "update public.contrats set contenu = '<p>Après signature</p>' where id = $1", [d.contrat])).toBe(true);
      expect(await estRefusee(client, "update public.contrats set document_fige = false where id = $1", [d.contrat])).toBe(true);
    }));

  test("le document d'un contrat d'une autre entreprise est inaccessible", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect(await idsVisibles(client, "contrats")).not.toContain(d.contrat);
      expect((await client.query("update public.contrats set contenu = '<p>Piège</p>' where id = $1", [d.contrat])).rowCount).toBe(0);
    }));
});
