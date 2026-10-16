import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

// A1 : Awa (compte salarié) et un collègue, chacun avec un bulletin d'octobre ; B1 : un salarié et son bulletin.
async function preparer(client: pg.Client, jeu: JeuDeDonnees, statut: "publiee" | "brouillon" = "publiee") {
  await client.query("reset role");
  const salarie = async (e: string, m: string, tel: string) =>
    (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, telephone) values ($1, $2, 'N', 'P', '2024-01-15', $3) returning id", [e, m, tel])).rows[0].id as string;
  const periode = async (e: string) =>
    (await client.query("insert into public.periodes_paie (entreprise_id, annee, mois, statut) values ($1, 2026, 10, $2) returning id", [e, statut])).rows[0].id as string;
  const bulletin = async (e: string, p: string, s: string) =>
    (
      await client.query(
        `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256)
         values ($1, $2, $3, $4, 'b.pdf', 1000, repeat('a', 64)) returning id`,
        [e, p, s, `${e}/${p}/${s}.pdf`],
      )
    ).rows[0].id as string;

  const awa = await salarie(jeu.entreprises.A1, "E-1", "+24177300001");
  const collegue = await salarie(jeu.entreprises.A1, "E-2", "+24177300002");
  const autre = await salarie(jeu.entreprises.B1, "E-3", "+24177300003");
  const pA = await periode(jeu.entreprises.A1);
  const pB = await periode(jeu.entreprises.B1);
  const bulletinAwa = await bulletin(jeu.entreprises.A1, pA, awa);
  const bulletinCollegue = await bulletin(jeu.entreprises.A1, pA, collegue);
  const bulletinB = await bulletin(jeu.entreprises.B1, pB, autre);

  const compteAwa = randomUUID();
  await client.query("insert into auth.users (id, phone, aud, role) values ($1, '24177300001', 'authenticated', 'authenticated')", [compteAwa]);
  await client.query("select public.rattacher_compte_salarie('+24177300001', $1)", [compteAwa]);
  return { awa, collegue, compteAwa, pA, bulletinAwa, bulletinCollegue, bulletinB };
}

describe("Émargement électronique et avis WhatsApp", () => {
  test("le salarié n'émarge que SON bulletin publié ; le premier émargement fait foi", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      const premier = (await client.query("select public.emarger_mon_bulletin($1, '1.2.3.4', 'test') as le", [d.bulletinAwa])).rows[0].le;
      const second = (await client.query("select public.emarger_mon_bulletin($1) as le", [d.bulletinAwa])).rows[0].le;
      expect(second).toEqual(premier);
      expect(await estRefusee(client, "select public.emarger_mon_bulletin($1)", [d.bulletinCollegue])).toBe(true);
      expect(await estRefusee(client, "select public.emarger_mon_bulletin($1)", [d.bulletinB])).toBe(true);
      expect(await idsVisibles(client, "emargements_bulletins", "bulletin_id")).toEqual([d.bulletinAwa]);
    }));

  test("pas d'émargement d'un bulletin non publié", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu, "brouillon");
      await commeUtilisateur(client, d.compteAwa);
      expect(await estRefusee(client, "select public.emarger_mon_bulletin($1)", [d.bulletinAwa])).toBe(true);
    }));

  test("l'employeur voit les émargements de son entreprise mais ne peut ni en créer ni en modifier", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      await client.query("select public.emarger_mon_bulletin($1)", [d.bulletinAwa]);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "emargements_bulletins", "bulletin_id")).toEqual([d.bulletinAwa]);
      expect(
        await estRefusee(client, "insert into public.emargements_bulletins (bulletin_id, entreprise_id, salarie_id) values ($1, $2, $3)", [
          d.bulletinCollegue,
          jeu.entreprises.A1,
          d.collegue,
        ]),
      ).toBe(true);
      expect(await estRefusee(client, "update public.emargements_bulletins set emarge_le = now() - interval '10 days'")).toBe(true);
      // L'employeur ne peut pas « émarger » à la place du salarié
      expect(await estRefusee(client, "select public.emarger_mon_bulletin($1)", [d.bulletinCollegue])).toBe(true);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect(await idsVisibles(client, "emargements_bulletins", "bulletin_id")).toEqual([]);
    }));

  test("avis WhatsApp : lecture par l'entreprise seule, aucune écriture hors serveur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await client.query("reset role");
      const avis = (
        await client.query("insert into public.avis_bulletins (bulletin_id, entreprise_id, periode_id, salarie_id, statut) values ($1, $2, $3, $4, 'envoye') returning id", [
          d.bulletinAwa,
          jeu.entreprises.A1,
          d.pA,
          d.awa,
        ])
      ).rows[0].id;
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "avis_bulletins")).toEqual([avis]);
      expect(await estRefusee(client, "update public.avis_bulletins set statut = 'lu'")).toBe(true);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect(await idsVisibles(client, "avis_bulletins")).toEqual([]);
      await commeUtilisateur(client, d.compteAwa);
      expect(await idsVisibles(client, "avis_bulletins")).toEqual([]);
    }));

  test("le salarié ne modifie que son propre accord WhatsApp", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      await client.query("select public.definir_mon_accord_whatsapp(true)");
      expect((await client.query("select public.mon_accord_whatsapp() as ok")).rows[0].ok).toBe(true);
      await client.query("reset role");
      const accords = (await client.query("select id, accord_whatsapp_le is not null as accord from public.salaries where id = any($1)", [[d.awa, d.collegue]])).rows;
      expect(Object.fromEntries(accords.map((r) => [r.id, r.accord]))).toEqual({ [d.awa]: true, [d.collegue]: false });
    }));
});
