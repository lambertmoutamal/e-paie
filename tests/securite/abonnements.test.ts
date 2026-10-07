import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import {
  commeUtilisateur,
  creerJeuDeDonnees,
  dansUneTransaction,
  estRefusee,
  fermerConnexion,
  idsVisibles,
} from "./outils";

afterAll(fermerConnexion);

// Donne au cabinet A un abonnement dont la fin est décalée de « jours » par rapport à aujourd'hui
// (négatif = dans le passé). Exécuté en tant que propriétaire de la base.
async function abonnerCabinetA(client: pg.Client, cabinetId: string, jours: number) {
  await client.query("reset role");
  await client.query(
    `insert into public.abonnements (cabinet_id, formule_id, statut, debut, fin)
     select $1, f.id, 'essai', now() - interval '60 days', now() + make_interval(days => $2)
     from public.formules f where f.code = 'essai'`,
    [cabinetId, jours],
  );
}

async function peutGerer(client: pg.Client, entrepriseId: string) {
  const { rows } = await client.query("select public.peut_gerer_entreprise($1) as r", [entrepriseId]);
  return rows[0].r as boolean;
}

describe("Phases de l'abonnement (appliquées par la base)", () => {
  test("pendant l'essai : accès complet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, 10);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);

      expect(await peutGerer(client, jeu.entreprises.A1)).toBe(true);
      const r = await client.query("update public.entreprises set nif = 'X' where id = $1", [jeu.entreprises.A1]);
      expect(r.rowCount).toBe(1);
    }));

  test("lecture seule (fin dépassée de moins de 30 jours) : on consulte mais on ne modifie plus", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, -5);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await idsVisibles(client, "entreprises")).toEqual(expect.arrayContaining([jeu.entreprises.A1]));
      expect(await peutGerer(client, jeu.entreprises.A1)).toBe(false);
      const modif = await client.query("update public.entreprises set nif = 'X' where id = $1", [jeu.entreprises.A1]);
      expect(modif.rowCount).toBe(0);
      expect(
        await estRefusee(client, "insert into public.entreprises (cabinet_id, raison_sociale) values ($1, 'Nouvelle')", [
          jeu.cabinets.A,
        ]),
      ).toBe(true);
      expect(
        await estRefusee(client, "insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'rh')", [
          jeu.entreprises.A1,
          jeu.utilisateurs.sansAffectation,
        ]),
      ).toBe(true);

      // Le gestionnaire voit encore son entreprise
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "entreprises")).toEqual([jeu.entreprises.A1]);
    }));

  test("bloqué (plus de 30 jours après la fin) : plus aucun accès aux entreprises", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, -31);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await idsVisibles(client, "entreprises")).toEqual([]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "entreprises")).toEqual([]);
      expect(await idsVisibles(client, "affectations", "entreprise_id")).toEqual([]);
    }));

  test("bloqué : l'admin du cabinet voit encore son abonnement (pour pouvoir payer)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, -31);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const { rows } = await client.query("select phase from public.mes_abonnements()");
      expect(rows).toEqual([{ phase: "bloque" }]);
    }));

  test("le blocage d'un cabinet n'affecte pas les autres cabinets", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, -31);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect(await idsVisibles(client, "entreprises")).toEqual([jeu.entreprises.B1]);
    }));

  test("l'administrateur plateforme garde l'accès à tout", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, -31);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await idsVisibles(client, "entreprises")).toEqual(expect.arrayContaining([jeu.entreprises.A1]));
    }));
});

describe("Abonnements et formules", () => {
  test("un client ne peut pas prolonger lui-même son abonnement", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, -5);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      const r = await client.query("update public.abonnements set fin = now() + interval '10 years'");
      expect(r.rowCount).toBe(0);
    }));

  test("un admin cabinet ne voit pas l'abonnement d'un autre cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, 10);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await idsVisibles(client, "abonnements", "cabinet_id")).toEqual([]);
      expect((await client.query("select * from public.mes_abonnements()")).rows).toEqual([]);
    }));

  test("les formules actives sont publiques, mais seul l'admin plateforme change les prix", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, null);
      const { rows } = await client.query("select code from public.formules");
      expect(rows.map((r) => r.code)).toEqual(expect.arrayContaining(["essai", "pro_cabinet", "pro_entreprise"]));
      expect(await estRefusee(client, "update public.formules set prix_mensuel = 1")).toBe(true);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect((await client.query("update public.formules set prix_mensuel = 1")).rowCount).toBe(0);

      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect((await client.query("update public.formules set prix_mensuel = 25000 where code = 'pro_cabinet'")).rowCount).toBe(1);
    }));

  test("demander le passage à Pro : seulement pour son propre abonnement", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await abonnerCabinetA(client, jeu.cabinets.A, 10);
      const { rows } = await client.query("select id from public.abonnements where cabinet_id = $1", [jeu.cabinets.A]);
      const id = rows[0].id;

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await estRefusee(client, "select public.demander_passage_pro($1)", [id])).toBe(true);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, "select public.demander_passage_pro($1)", [id])).toBe(false);
    }));
});

describe("Inscription libre", () => {
  const inscription = (type: string) => ({
    email: "prospect@exemple.ga",
    app_metadata: { inscription: { type, nom_structure: "Prospect SARL", formule: "essai" } },
  });

  test("une entreprise inscrite devient autonome, avec son administrateur et 30 jours d'essai", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const id = jeu.utilisateurs.sansAffectation;
      await commeUtilisateur(client, id, inscription("entreprise"));

      const { rows } = await client.query("select public.finaliser_inscription() as r");
      const entrepriseId = rows[0].r.entreprise_id;
      expect(entrepriseId).toBeTruthy();

      const { rows: abos } = await client.query("select phase, jours_restants from public.mes_abonnements()");
      expect(abos).toEqual([{ phase: "essai", jours_restants: 30 }]);
      expect(await peutGerer(client, entrepriseId)).toBe(true);

      // Elle ne voit rien des autres entreprises
      expect(await idsVisibles(client, "entreprises")).toEqual([entrepriseId]);
    }));

  test("un cabinet inscrit est créé avec son administrateur", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation, inscription("cabinet"));
      const { rows } = await client.query("select public.finaliser_inscription() as r");
      expect(rows[0].r.cabinet_id).toBeTruthy();
      expect(await idsVisibles(client, "cabinets")).toEqual([rows[0].r.cabinet_id]);
    }));

  test("finaliser deux fois ne crée pas de doublon", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation, inscription("cabinet"));
      const a = (await client.query("select public.finaliser_inscription() as r")).rows[0].r;
      const b = (await client.query("select public.finaliser_inscription() as r")).rows[0].r;
      expect(b.cabinet_id).toBe(a.cabinet_id);
      expect(await idsVisibles(client, "cabinets")).toHaveLength(1);
    }));

  test("impossible de s'inventer une inscription (user_metadata modifiable par l'utilisateur)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation, {
        user_metadata: { inscription: { type: "cabinet", nom_structure: "Faux" } },
      });
      expect(await estRefusee(client, "select public.finaliser_inscription()")).toBe(true);
    }));

  test("un admin entreprise gère son entreprise autonome mais ne peut pas la rattacher à un cabinet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation, inscription("entreprise"));
      const entrepriseId = (await client.query("select public.finaliser_inscription() as r")).rows[0].r.entreprise_id;

      expect(
        (await client.query("update public.entreprises set nif = '123' where id = $1", [entrepriseId])).rowCount,
      ).toBe(1);
      expect(
        await estRefusee(client, "update public.entreprises set cabinet_id = $1 where id = $2", [
          jeu.cabinets.A,
          entrepriseId,
        ]),
      ).toBe(true);
      expect(await peutGerer(client, jeu.entreprises.A1)).toBe(false);
    }));
});
