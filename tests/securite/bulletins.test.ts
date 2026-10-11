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

const EMPREINTE = "a".repeat(64);

// Pour A1 et B1 : un salarié, une période d'octobre 2026 en brouillon, un bulletin.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const ids: Record<string, string> = {};
  for (const [cle, entreprise] of [["A1", jeu.entreprises.A1], ["B1", jeu.entreprises.B1]] as const) {
    const s = await client.query(
      "insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, $2, 'N', 'P', '2024-01-01') returning id",
      [entreprise, `M-${cle}`],
    );
    const p = await client.query(
      "insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 10) returning id",
      [entreprise],
    );
    const chemin = `${entreprise}/${p.rows[0].id}/${s.rows[0].id}-1.pdf`;
    const b = await client.query(
      `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256)
       values ($1, $2, $3, $4, 'b.pdf', 100, $5) returning id`,
      [entreprise, p.rows[0].id, s.rows[0].id, chemin, EMPREINTE],
    );
    await client.query("insert into storage.objects (bucket_id, name) values ('bulletins', $1)", [chemin]);
    ids[`salarie${cle}`] = s.rows[0].id;
    ids[`periode${cle}`] = p.rows[0].id;
    ids[`bulletin${cle}`] = b.rows[0].id;
    ids[`chemin${cle}`] = chemin;
  }
  return ids;
}

const DEPOT = `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par)
               values ($1, $2, $3, $4, 'x.pdf', 10, '${EMPREINTE}', $5)`;

describe("Isolation des bulletins", () => {
  test("un gestionnaire ne voit que les périodes, bulletins et fichiers de son entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "periodes_paie")).toEqual([ids.periodeA1]);
      expect(await idsVisibles(client, "bulletins")).toEqual([ids.bulletinA1]);
      const { rows } = await client.query("select name from storage.objects where bucket_id = 'bulletins'");
      expect(rows.map((r) => r.name)).toEqual([ids.cheminA1]);
    }));

  test("impossible de déposer un bulletin dans une autre entreprise, ou pour un salarié d'une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      const g = jeu.utilisateurs.gestionnaireA1;
      await client.query("reset role");
      await client.query("delete from public.bulletins where id = $1", [ids.bulletinA1]);
      await commeUtilisateur(client, g);
      expect(await estRefusee(client, DEPOT, [jeu.entreprises.B1, ids.periodeB1, ids.salarieB1, `${jeu.entreprises.B1}/x/1.pdf`, g])).toBe(true);
      expect(await estRefusee(client, DEPOT, [jeu.entreprises.A1, ids.periodeA1, ids.salarieB1, `${jeu.entreprises.A1}/x/2.pdf`, g])).toBe(true);
      expect(await estRefusee(client, DEPOT, [jeu.entreprises.A1, ids.periodeB1, ids.salarieA1, `${jeu.entreprises.A1}/x/3.pdf`, g])).toBe(true);
      expect(await estRefusee(client, DEPOT, [jeu.entreprises.A1, ids.periodeA1, ids.salarieA1, `${jeu.entreprises.A1}/x/4.pdf`, g])).toBe(false);
    }));

  test("impossible de stocker un fichier dans le dossier bulletins d'une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(
        await estRefusee(client, "insert into storage.objects (bucket_id, name) values ('bulletins', $1)", [
          `${jeu.entreprises.B1}/${ids.periodeB1}/piege.pdf`,
        ]),
      ).toBe(true);
    }));
});

describe("Droits de dépôt", () => {
  test("le contrôleur, le signataire et le RH consultent mais ne déposent pas", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      const u = jeu.utilisateurs.sansAffectation;
      for (const role of ["controleur", "signataire", "rh"]) {
        await client.query("reset role");
        await client.query("delete from public.affectations where profil_id = $1", [u]);
        await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, $3)", [jeu.entreprises.A1, u, role]);
        await commeUtilisateur(client, u);
        expect(await idsVisibles(client, "bulletins"), role).toEqual([ids.bulletinA1]);
        expect((await client.query("delete from public.bulletins where id = $1", [ids.bulletinA1])).rowCount, role).toBe(0);
        expect(await estRefusee(client, "insert into public.periodes_paie (entreprise_id, annee, mois, cree_par) values ($1, 2026, 11, $2)", [jeu.entreprises.A1, u]), role).toBe(true);
      }
    }));

  test("une période qui n'est plus en brouillon est verrouillée (ni dépôt, ni remplacement, ni retrait)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await client.query("update public.periodes_paie set statut = 'en_validation' where id = $1", [ids.periodeA1]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect((await client.query("delete from public.bulletins where id = $1", [ids.bulletinA1])).rowCount).toBe(0);
      expect((await client.query("update public.bulletins set fichier_nom = 'x' where id = $1", [ids.bulletinA1])).rowCount).toBe(0);
      expect(
        await estRefusee(client, "insert into storage.objects (bucket_id, name) values ('bulletins', $1)", [
          `${jeu.entreprises.A1}/${ids.periodeA1}/nouveau.pdf`,
        ]),
      ).toBe(true);
    }));

  test("un seul bulletin par salarié et par période", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      const g = jeu.utilisateurs.gestionnaireA1;
      await commeUtilisateur(client, g);
      expect(await estRefusee(client, DEPOT, [jeu.entreprises.A1, ids.periodeA1, ids.salarieA1, `${jeu.entreprises.A1}/x/doublon.pdf`, g])).toBe(true);
    }));

  test("un bulletin ne peut pas être signé au nom d'un autre déposant", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await client.query("reset role");
      await client.query("delete from public.bulletins where id = $1", [ids.bulletinA1]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(
        await estRefusee(client, DEPOT, [jeu.entreprises.A1, ids.periodeA1, ids.salarieA1, `${jeu.entreprises.A1}/x/5.pdf`, jeu.utilisateurs.adminCabinetA]),
      ).toBe(true);
    }));
});
