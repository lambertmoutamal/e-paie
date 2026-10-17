import type pg from "pg";
import { afterAll, describe, expect, test } from "vitest";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

const DEPOT = `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par)
               values ($1, $2, $3, $4, 'b.pdf', 1, repeat('a', 64), $5)`;

// Un salarié et une période en brouillon dans A1 et dans B1, et un bulletin déjà déposé dans A1.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const ids: Record<string, string> = {};
  for (const [cle, entreprise] of [["A1", jeu.entreprises.A1], ["B1", jeu.entreprises.B1]] as const) {
    ids[`salarie${cle}`] = (
      await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, $2, 'N', 'P', '2024-01-01') returning id", [
        entreprise,
        `SIG-${cle}`,
      ])
    ).rows[0].id;
    ids[`periode${cle}`] = (await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 10) returning id", [entreprise])).rows[0].id;
  }
  ids.bulletinA1 = (
    await client.query(
      "insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256) values ($1, $2, $3, $4, 'b.pdf', 1, repeat('a', 64)) returning id",
      [jeu.entreprises.A1, ids.periodeA1, ids.salarieA1, `${jeu.entreprises.A1}/${ids.periodeA1}/x.pdf`],
    )
  ).rows[0].id;
  return ids;
}

async function commeServeur(client: pg.Client) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
  await client.query("set local role service_role");
}

describe("Version signée des bulletins", () => {
  test("ni le déposant ni un administrateur ne peuvent poser ou changer la version signée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      for (const utilisateur of [jeu.utilisateurs.gestionnaireA1, jeu.utilisateurs.adminCabinetA]) {
        await commeUtilisateur(client, utilisateur);
        expect(await estRefusee(client, "update public.bulletins set fichier_signe_chemin = 'faux.pdf' where id = $1", [ids.bulletinA1])).toBe(true);
        expect(await estRefusee(client, "update public.bulletins set signe_le = now() where id = $1", [ids.bulletinA1])).toBe(true);
      }
    }));

  test("le déposant ne peut pas poser la version signée dès le dépôt", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await client.query("delete from public.bulletins where id = $1", [ids.bulletinA1]);
      const g = jeu.utilisateurs.gestionnaireA1;
      const dossier = `${jeu.entreprises.A1}/${ids.periodeA1}/`;
      await commeUtilisateur(client, g);

      const avecSignature = (colonnes: string, valeurs: string) =>
        `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par, ${colonnes})
         values ($1, $2, $3, $4, 'b.pdf', 1, repeat('a', 64), $5, ${valeurs})`;
      const params = [jeu.entreprises.A1, ids.periodeA1, ids.salarieA1, `${dossier}vrai.pdf`, g];
      expect(await estRefusee(client, avecSignature("fichier_signe_chemin", `'${dossier}signes/faux.pdf'`), params)).toBe(true);
      expect(await estRefusee(client, avecSignature("empreinte_signee", "repeat('b', 64)"), params)).toBe(true);
      expect(await estRefusee(client, avecSignature("signe_le", "now()"), params)).toBe(true);
      // Le dépôt normal, lui, reste possible
      expect(await estRefusee(client, DEPOT, params)).toBe(false);
    }));

  test("le fichier d'un bulletin reste dans le dossier de son entreprise et de sa période", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await client.query("delete from public.bulletins where id = $1", [ids.bulletinA1]);
      const g = jeu.utilisateurs.gestionnaireA1;
      const A1 = jeu.entreprises.A1;
      const B1 = jeu.entreprises.B1;
      await commeUtilisateur(client, g);

      const depot = (chemin: string) => estRefusee(client, DEPOT, [A1, ids.periodeA1, ids.salarieA1, chemin, g]);
      expect(await depot(`${B1}/${ids.periodeB1}/signes/bulletin-de-b.pdf`)).toBe(true);
      expect(await depot(`${A1}/${ids.periodeB1}/autre-periode.pdf`)).toBe(true);
      expect(await depot(`${A1}/${ids.periodeA1}/../../${B1}/${ids.periodeB1}/b.pdf`)).toBe(true);
      expect(await depot(`autre-dossier/b.pdf`)).toBe(true);
      expect(await depot(`${A1}/${ids.periodeA1}/bon.pdf`)).toBe(false);
    }));

  test("le remplacement d'un fichier ne peut pas pointer vers une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const remplacer = (chemin: string) =>
        estRefusee(client, "update public.bulletins set fichier_chemin = $1, depose_par = $2 where id = $3", [chemin, jeu.utilisateurs.gestionnaireA1, ids.bulletinA1]);
      expect(await remplacer(`${jeu.entreprises.B1}/${ids.periodeB1}/b.pdf`)).toBe(true);
      expect(await remplacer(`${jeu.entreprises.A1}/${ids.periodeA1}/nouveau.pdf`)).toBe(false);
    }));

  test("même le serveur ne range la version signée que dans le dossier signes/ de la période", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const ids = await preparer(client, jeu);
      await commeServeur(client);
      const signer = (chemin: string) =>
        estRefusee(client, "update public.bulletins set fichier_signe_chemin = $1, signe_le = now() where id = $2", [chemin, ids.bulletinA1]);
      expect(await signer(`${jeu.entreprises.B1}/${ids.periodeB1}/signes/b.pdf`)).toBe(true);
      expect(await signer(`${jeu.entreprises.A1}/${ids.periodeA1}/hors-signes.pdf`)).toBe(true);
      expect(await signer(`${jeu.entreprises.A1}/${ids.periodeA1}/signes/${ids.bulletinA1}.pdf`)).toBe(false);
    }));
});
