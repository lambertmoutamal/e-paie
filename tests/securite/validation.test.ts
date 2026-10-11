import { randomUUID } from "node:crypto";
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

// Crée une personne ayant les rôles donnés dans une entreprise.
async function creerPersonne(client: pg.Client, entrepriseId: string, roles: string[]) {
  await client.query("reset role");
  const id = randomUUID();
  await client.query("insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [
    id,
    `${id.slice(0, 8)}@test.e-paie.local`,
  ]);
  for (const role of roles) {
    await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, $3)", [entrepriseId, id, role]);
  }
  return id;
}

// Une période d'octobre 2026 en A1 avec un bulletin, et les personnes du circuit par défaut.
async function preparer(client: pg.Client, jeu: JeuDeDonnees, deposant: string | null = null) {
  await client.query("reset role");
  const e = jeu.entreprises.A1;
  const { rows: s } = await client.query(
    "insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, 'M1', 'N', 'P', '2024-01-01') returning id",
    [e],
  );
  const { rows: p } = await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 10) returning id", [e]);
  await client.query(
    `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par)
     values ($1, $2, $3, $4, 'b.pdf', 100, $5, $6)`,
    [e, p[0].id, s[0].id, `${e}/${p[0].id}/${s[0].id}-1.pdf`, "a".repeat(64), deposant],
  );
  const controleur = await creerPersonne(client, e, ["controleur"]);
  const signataire = await creerPersonne(client, e, ["signataire"]);
  return { periode: p[0].id as string, controleur, signataire };
}

async function etat(client: pg.Client, periode: string) {
  const { rows } = await client.query("select statut, etape_courante from public.periodes_paie where id = $1", [periode]);
  return rows[0];
}

async function comme(client: pg.Client, id: string, sql: string, params: unknown[]) {
  await commeUtilisateur(client, id);
  return client.query(sql, params);
}

describe("Circuit de validation", () => {
  test("circuit par défaut : envoi, contrôle puis approbation, avec historique", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode, controleur, signataire } = await preparer(client, jeu);

      await comme(client, jeu.utilisateurs.gestionnaireA1, "select public.soumettre_periode($1)", [periode]);
      expect(await etat(client, periode)).toEqual({ statut: "en_validation", etape_courante: 1 });

      // Le signataire ne peut pas sauter l'étape de contrôle
      await commeUtilisateur(client, signataire);
      expect(await estRefusee(client, "select public.valider_etape($1)", [periode])).toBe(true);

      await comme(client, controleur, "select public.valider_etape($1)", [periode]);
      expect(await etat(client, periode)).toEqual({ statut: "en_validation", etape_courante: 2 });
      await comme(client, signataire, "select public.valider_etape($1, 'RAS')", [periode]);
      expect(await etat(client, periode)).toEqual({ statut: "approuvee", etape_courante: null });

      const { rows } = await client.query("select action, etape from public.validations_periode where periode_id = $1 order by cree_le, etape", [periode]);
      expect(rows).toEqual([
        { action: "soumission", etape: 0 },
        { action: "validation", etape: 1 },
        { action: "validation", etape: 2 },
      ]);
      // Une période approuvée est verrouillée
      expect(await estRefusee(client, "select public.refuser_etape($1, 'trop tard')", [periode])).toBe(true);
    }));

  test("refus : commentaire obligatoire, retour à l'étape précédente puis au brouillon", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode, controleur, signataire } = await preparer(client, jeu);
      await comme(client, jeu.utilisateurs.gestionnaireA1, "select public.soumettre_periode($1)", [periode]);
      await comme(client, controleur, "select public.valider_etape($1)", [periode]);

      await commeUtilisateur(client, signataire);
      expect(await estRefusee(client, "select public.refuser_etape($1, '  ')", [periode])).toBe(true);
      await client.query("select public.refuser_etape($1, 'Prime oubliée pour M1')", [periode]);
      expect(await etat(client, periode)).toEqual({ statut: "en_validation", etape_courante: 1 });

      // Le contrôleur doit revalider (sa validation a été annulée) ; il peut aussi refuser
      await comme(client, controleur, "select public.refuser_etape($1, 'À corriger, voir signataire')", [periode]);
      expect(await etat(client, periode)).toEqual({ statut: "brouillon", etape_courante: null });

      // De retour en brouillon : le gestionnaire peut corriger les bulletins
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect((await client.query("update public.bulletins set fichier_nom = 'corrige.pdf', depose_par = $2 where periode_id = $1", [periode, jeu.utilisateurs.gestionnaireA1])).rowCount).toBe(1);
    }));
});

describe("Séparation des tâches", () => {
  test("l'émetteur ne valide pas, même s'il a le rôle requis", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode } = await preparer(client, jeu);
      await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'controleur')", [
        jeu.entreprises.A1,
        jeu.utilisateurs.gestionnaireA1,
      ]);
      await comme(client, jeu.utilisateurs.gestionnaireA1, "select public.soumettre_periode($1)", [periode]);
      expect(await estRefusee(client, "select public.valider_etape($1)", [periode])).toBe(true);
    }));

  test("une même personne ne valide pas deux étapes", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode } = await preparer(client, jeu);
      const double = await creerPersonne(client, jeu.entreprises.A1, ["controleur", "signataire"]);
      await comme(client, jeu.utilisateurs.gestionnaireA1, "select public.soumettre_periode($1)", [periode]);
      await comme(client, double, "select public.valider_etape($1)", [periode]);
      expect(await estRefusee(client, "select public.valider_etape($1)", [periode])).toBe(true);
    }));

  test("une personne qui a déposé des bulletins ne valide pas la période", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode } = await preparer(client, jeu, jeu.utilisateurs.adminCabinetA);
      await comme(client, jeu.utilisateurs.adminCabinetA, "select public.definir_circuit($1, $2)", [
        jeu.entreprises.A1,
        JSON.stringify([{ libelle: "Visa du cabinet", role: "administrateur" }]),
      ]);
      await comme(client, jeu.utilisateurs.gestionnaireA1, "select public.soumettre_periode($1)", [periode]);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, "select public.valider_etape($1)", [periode])).toBe(true);
    }));
});

describe("Isolation et protections", () => {
  test("une autre entreprise ne voit ni le circuit ni l'historique, et ne peut pas valider", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode } = await preparer(client, jeu);
      await comme(client, jeu.utilisateurs.adminCabinetA, "select public.definir_circuit($1, $2)", [
        jeu.entreprises.A1,
        JSON.stringify([{ libelle: "Contrôle", role: "controleur" }]),
      ]);
      await comme(client, jeu.utilisateurs.gestionnaireA1, "select public.soumettre_periode($1)", [periode]);
      const controleurB = await creerPersonne(client, jeu.entreprises.B1, ["controleur"]);

      await commeUtilisateur(client, controleurB);
      expect(await idsVisibles(client, "etapes_circuit")).toEqual([]);
      expect(await idsVisibles(client, "validations_periode")).toEqual([]);
      expect(await estRefusee(client, "select public.valider_etape($1)", [periode])).toBe(true);
      expect(await estRefusee(client, "select public.refuser_etape($1, 'refus pirate')", [periode])).toBe(true);
      const { rows } = await client.query("select public.circuit_entreprise($1) as c", [jeu.entreprises.A1]);
      expect(rows[0].c).toBeNull();
    }));

  test("seuls les administrateurs de l'entreprise règlent son circuit", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const circuit = JSON.stringify([{ libelle: "Contrôle", role: "controleur" }]);
      const sql = "select public.definir_circuit($1, $2)";
      for (const u of [jeu.utilisateurs.gestionnaireA1, jeu.utilisateurs.adminCabinetB]) {
        await commeUtilisateur(client, u);
        expect(await estRefusee(client, sql, [jeu.entreprises.A1, circuit])).toBe(true);
      }
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect(await estRefusee(client, sql, [jeu.entreprises.A1, "[]"])).toBe(true);
      expect(await estRefusee(client, sql, [jeu.entreprises.A1, circuit])).toBe(false);
    }));

  test("impossible de contourner le circuit en écrivant directement dans les tables", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { periode } = await preparer(client, jeu);
      const g = jeu.utilisateurs.gestionnaireA1;
      await commeUtilisateur(client, g);
      expect(await estRefusee(client, "update public.periodes_paie set statut = 'approuvee' where id = $1", [periode])).toBe(true);
      expect(
        await estRefusee(
          client,
          "insert into public.periodes_paie (entreprise_id, annee, mois, cree_par, statut) values ($1, 2026, 11, $2, 'approuvee')",
          [jeu.entreprises.A1, g],
        ),
      ).toBe(true);
      expect(
        await estRefusee(
          client,
          "insert into public.validations_periode (periode_id, entreprise_id, cycle, etape, libelle_etape, action) values ($1, $2, 1, 1, 'x', 'validation')",
          [periode, jeu.entreprises.A1],
        ),
      ).toBe(true);
      // Une période vide ne peut pas être envoyée en validation
      await client.query("reset role");
      const { rows } = await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 12) returning id", [jeu.entreprises.A1]);
      await commeUtilisateur(client, g);
      expect(await estRefusee(client, "select public.soumettre_periode($1)", [rows[0].id])).toBe(true);
    }));
});
