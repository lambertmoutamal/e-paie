import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

// A1 : Awa (compte salarié), un RH ; types et réglages par défaut.
async function preparer(client: pg.Client, jeu: JeuDeDonnees, embauche = "2024-01-15") {
  await client.query("reset role");
  const awa = (
    await client.query(
      "insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, telephone) values ($1, 'A-1', 'N', 'P', $2, '+24177200001') returning id",
      [jeu.entreprises.A1, embauche],
    )
  ).rows[0].id as string;
  const compte = randomUUID();
  await client.query("insert into auth.users (id, phone, aud, role) values ($1, '24177200001', 'authenticated', 'authenticated')", [compte]);
  await client.query("select public.rattacher_compte_salarie('+24177200001', $1)", [compte]);
  const rh = randomUUID();
  await client.query("insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [rh, `rh-${rh.slice(0, 6)}@test.e-paie.local`]);
  await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'rh')", [jeu.entreprises.A1, rh]);
  const types = Object.fromEntries(
    (await client.query("select libelle, id from public.types_absence where entreprise_id = $1", [jeu.entreprises.A1])).rows.map((r) => [r.libelle, r.id]),
  );
  return { awa, compte, rh, conge: types["Congé payé"] as string, deces: types["Permission : décès d'un proche"] as string };
}

async function regler(client: pg.Client, entreprise: string, champs: Record<string, unknown>) {
  await client.query("reset role");
  const cles = Object.keys(champs);
  await client.query(
    `update public.parametres_conges set ${cles.map((c, i) => `${c} = $${i + 2}`).join(", ")} where entreprise_id = $1`,
    [entreprise, ...Object.values(champs)],
  );
}

const DEMANDER = "select public.demander_absence($1, $2, current_date + $3::integer, current_date + $4::integer, false, false, null, null) as id";
const aTraiter = async (client: pg.Client, u: string) => {
  await commeUtilisateur(client, u);
  return (await client.query("select demande_id from public.mes_demandes_a_traiter()")).rows.map((r) => r.demande_id);
};

describe("Qui valide les demandes", () => {
  test("seul un administrateur choisit le mode de validation", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const sql = "update public.parametres_conges set validation_absences = 'administrateurs' where entreprise_id = $1";
      await commeUtilisateur(client, d.rh);
      expect(await estRefusee(client, sql, [jeu.entreprises.A1])).toBe(true);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect((await client.query(sql, [jeu.entreprises.A1])).rowCount).toBe(1);
    }));

  test("RH puis administrateur : deux validations, par deux personnes, à la bonne étape", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await regler(client, jeu.entreprises.A1, { validation_absences: "rh_puis_administrateur" });
      await commeUtilisateur(client, d.compte);
      const id = (await client.query(DEMANDER, [d.awa, d.conge, 30, 31])).rows[0].id;

      expect(await aTraiter(client, d.rh)).toEqual([id]);
      expect(await aTraiter(client, jeu.utilisateurs.adminCabinetA)).toEqual([]);
      await commeUtilisateur(client, d.rh);
      expect((await client.query("select public.decider_demande($1, true) as r", [id])).rows[0].r).toBe("prevalidee");

      // Le RH ne peut pas donner la seconde validation ; l'administrateur oui
      expect(await aTraiter(client, d.rh)).toEqual([]);
      await commeUtilisateur(client, d.rh);
      expect(await estRefusee(client, "select public.decider_demande($1, true)", [id])).toBe(true);
      expect(await aTraiter(client, jeu.utilisateurs.adminCabinetA)).toEqual([id]);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetA);
      expect((await client.query("select public.decider_demande($1, true) as r", [id])).rows[0].r).toBe("acceptee");
    }));

  test("mode administrateurs : le RH ne décide plus", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await regler(client, jeu.entreprises.A1, { validation_absences: "administrateurs" });
      await commeUtilisateur(client, d.compte);
      const id = (await client.query(DEMANDER, [d.awa, d.conge, 30, 30])).rows[0].id;
      expect(await aTraiter(client, d.rh)).toEqual([]);
      await commeUtilisateur(client, d.rh);
      expect(await estRefusee(client, "select public.decider_demande($1, true)", [id])).toBe(true);
      expect(await aTraiter(client, jeu.utilisateurs.adminCabinetA)).toEqual([id]);
    }));
});

describe("Règles des demandes", () => {
  test("solde négatif interdit : la demande qui dépasse le solde est refusée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await regler(client, jeu.entreprises.A1, { solde_negatif_autorise: false, decompte: "ouvres" });
      await client.query("insert into public.soldes_conges_initiaux (salarie_id, entreprise_id, date_reference, jours) values ($1, $2, current_date, 1)", [d.awa, jeu.entreprises.A1]);
      // Un lundi dans plusieurs semaines : 1 jour ouvré, puis 2 jours ouvrés
      const lundi = (await client.query("select (date_trunc('week', current_date) + interval '28 days')::date - current_date as n")).rows[0].n;
      await commeUtilisateur(client, d.compte);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.conge, lundi, lundi + 1])).toBe(true);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.conge, lundi, lundi])).toBe(false);
    }));

  test("délai de prévenance : pour les congés seulement, pas pour un décès", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await regler(client, jeu.entreprises.A1, { delai_prevenance_jours: 15 });
      await commeUtilisateur(client, d.compte);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.conge, 5, 6])).toBe(true);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.conge, 20, 21])).toBe(false);
      await client.query("reset role");
      await client.query("update public.types_absence set justificatif_requis = false where id = $1", [d.deces]);
      await commeUtilisateur(client, d.compte);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.deces, 1, 1])).toBe(false);
    }));
});

describe("Calcul du solde", () => {
  test("jours d'ancienneté ajoutés chaque mois selon les années de présence", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu, "2010-01-01");
      // 16 ans de présence, +1 jour par tranche de 5 ans → 3 jours par an
      await regler(client, jeu.entreprises.A1, { anciennete_tranche_ans: 5, anciennete_jours_par_tranche: 1 });
      await client.query("insert into public.soldes_conges_initiaux (salarie_id, entreprise_id, date_reference, jours) values ($1, $2, current_date - interval '12 months', 0)", [d.awa, jeu.entreprises.A1]);
      await commeUtilisateur(client, d.compte);
      const { rows } = await client.query("select acquis, anciennete, disponible from public.mon_solde_conges($1)", [d.awa]);
      expect(rows[0]).toEqual({ acquis: "24.00", anciennete: "3.00", disponible: "27.00" });
    }));

  test("report plafonné : au début de l'année de congés, l'excédent est perdu", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await regler(client, jeu.entreprises.A1, { report_max_jours: 5, mois_debut_reference: 1 });
      await client.query(
        "insert into public.soldes_conges_initiaux (salarie_id, entreprise_id, date_reference, jours) values ($1, $2, make_date(extract(year from current_date)::integer - 1, 1, 1), 0)",
        [d.awa, jeu.entreprises.A1],
      );
      await commeUtilisateur(client, d.compte);
      const { rows } = await client.query("select perdu from public.mon_solde_conges($1)", [d.awa]);
      expect(rows[0].perdu).toBe("19.00"); // 24 jours acquis l'an dernier, 5 reportés
    }));
});

describe("Date du dernier congé", () => {
  test("saisie par le RH, puis remplacée par le dernier congé enregistré ; visible seulement par qui y a droit", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.rh);
      await client.query("select public.definir_solde_initial($1, current_date, 10, '2026-07-01', '2026-07-20')", [d.awa]);
      const dernier = async () =>
        (await client.query("select debut::text, fin::text, source from public.derniers_conges_entreprise($1) where salarie_id = $2", [jeu.entreprises.A1, d.awa])).rows[0];
      expect(await dernier()).toEqual({ debut: "2026-07-01", fin: "2026-07-20", source: "saisie" });

      // Un congé accepté dans DématPaie devient le dernier congé
      await client.query("reset role");
      await client.query(
        "insert into public.demandes_absence (entreprise_id, salarie_id, type_id, debut, fin, nb_jours, statut) values ($1, $2, $3, current_date - 3, current_date - 2, 1, 'acceptee')",
        [jeu.entreprises.A1, d.awa, d.conge],
      );
      await commeUtilisateur(client, d.rh);
      expect((await dernier()).source).toBe("dematpaie");

      await commeUtilisateur(client, d.compte);
      expect((await client.query("select source from public.mon_dernier_conge($1)", [d.awa])).rows).toEqual([{ source: "dematpaie" }]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireB1);
      expect((await client.query("select * from public.derniers_conges_entreprise($1)", [jeu.entreprises.A1])).rows).toEqual([]);
    }));
});

