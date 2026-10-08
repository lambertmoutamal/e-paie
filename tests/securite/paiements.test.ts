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

// Abonnement du cabinet A (fin dans « jours » jours) et un paiement en attente.
async function preparer(client: pg.Client, cabinetId: string, jours: number, duree = 12) {
  await client.query("reset role");
  const { rows: abo } = await client.query(
    `insert into public.abonnements (cabinet_id, formule_id, statut, debut, fin)
     select $1, f.id, 'essai', now() - interval '120 days', now() + make_interval(days => $2)
     from public.formules f where f.code = 'essai' returning id, fin`,
    [cabinetId, jours],
  );
  const { rows: pai } = await client.query(
    `insert into public.paiements (abonnement_id, formule_id, duree_mois, montant, devise, telephone)
     select $1, f.id, $2, 1000, 'XAF', '+24177000000' from public.formules f where f.code = 'pro_cabinet'
     returning id`,
    [abo[0].id, duree],
  );
  return { abonnementId: abo[0].id as string, finAvant: abo[0].fin as Date, paiementId: pai[0].id as string };
}

async function appliquer(client: pg.Client, paiementId: string, statut: string) {
  await client.query("reset role");
  await client.query("set local role service_role");
  return (await client.query("select public.appliquer_paiement($1, $2) as s", [paiementId, statut])).rows[0].s;
}

async function lireAbonnement(client: pg.Client, id: string) {
  await client.query("reset role");
  return (await client.query("select statut, fin from public.abonnements where id = $1", [id])).rows[0];
}

describe("Application d'un paiement", () => {
  test("un paiement réussi active l'abonnement et prolonge de 12 mois à partir de la fin actuelle", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { abonnementId, finAvant, paiementId } = await preparer(client, jeu.cabinets.A, 10);

      expect(await appliquer(client, paiementId, "reussi")).toBe("reussi");
      const abo = await lireAbonnement(client, abonnementId);
      expect(abo.statut).toBe("actif");
      const attendu = new Date(finAvant);
      attendu.setMonth(attendu.getMonth() + 12);
      expect(Math.abs(new Date(abo.fin).getTime() - attendu.getTime())).toBeLessThan(2 * 86400_000);
    }));

  test("une confirmation reçue deux fois ne prolonge qu'une seule fois", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { abonnementId, paiementId } = await preparer(client, jeu.cabinets.A, 10, 1);

      await appliquer(client, paiementId, "reussi");
      const finApresUn = (await lireAbonnement(client, abonnementId)).fin;
      await appliquer(client, paiementId, "reussi");
      expect((await lireAbonnement(client, abonnementId)).fin).toEqual(finApresUn);
    }));

  test("un paiement échoué ne change pas l'abonnement, et ne peut plus devenir réussi", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { abonnementId, paiementId } = await preparer(client, jeu.cabinets.A, 10);
      const avant = await lireAbonnement(client, abonnementId);

      await appliquer(client, paiementId, "echoue");
      expect(await appliquer(client, paiementId, "reussi")).toBe("echoue");
      expect(await lireAbonnement(client, abonnementId)).toEqual(avant);
    }));

  test("un abonnement bloqué redémarre à partir d'aujourd'hui", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { abonnementId, paiementId } = await preparer(client, jeu.cabinets.A, -60, 1);
      await appliquer(client, paiementId, "reussi");
      const fin = new Date((await lireAbonnement(client, abonnementId)).fin);
      const dansUnMois = new Date();
      dansUnMois.setMonth(dansUnMois.getMonth() + 1);
      expect(Math.abs(fin.getTime() - dansUnMois.getTime())).toBeLessThan(2 * 86400_000);
    }));
});

describe("Sécurité des paiements", () => {
  test("aucun utilisateur ne peut valider un paiement lui-même (ni créer ni modifier)", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { abonnementId, paiementId } = await preparer(client, jeu.cabinets.A, 10);

      for (const id of [jeu.utilisateurs.adminCabinetA, jeu.utilisateurs.adminPlateforme]) {
        await commeUtilisateur(client, id);
        expect(await estRefusee(client, "select public.appliquer_paiement($1, 'reussi')", [paiementId])).toBe(true);
        expect(await estRefusee(client, "update public.paiements set statut = 'reussi' where id = $1", [paiementId])).toBe(true);
        expect(
          await estRefusee(
            client,
            `insert into public.paiements (abonnement_id, formule_id, duree_mois, montant, devise, telephone, statut)
             select $1, formule_id, 12, 1, 'XAF', '+24100000000', 'reussi' from public.abonnements where id = $1`,
            [abonnementId],
          ),
        ).toBe(true);
      }
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select public.appliquer_paiement($1, 'reussi')", [paiementId])).toBe(true);
    }));

  test("chacun ne voit que les paiements de ses propres abonnements", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { paiementId } = await preparer(client, jeu.cabinets.A, 10);

      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await idsVisibles(client, "paiements")).toEqual([paiementId]);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await idsVisibles(client, "paiements")).toEqual([]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "paiements")).toEqual([]);
      await commeUtilisateur(client, jeu.utilisateurs.adminPlateforme);
      expect(await idsVisibles(client, "paiements")).toContain(paiementId);
    }));
});
