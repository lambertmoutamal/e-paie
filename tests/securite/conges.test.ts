import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

async function creerCompte(client: pg.Client, champs: { email?: string; phone?: string }) {
  const id = randomUUID();
  await client.query("insert into auth.users (id, email, phone, aud, role) values ($1, $2, $3, 'authenticated', 'authenticated')", [
    id,
    champs.email ?? null,
    champs.phone ?? null,
  ]);
  return id;
}

// A1 : Awa (compte salarié) et un collègue ; un RH en A1 et un RH en B1.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const ins = async (e: string, m: string, tel: string | null) =>
    (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, telephone) values ($1, $2, 'N', 'P', '2024-01-15', $3) returning id", [e, m, tel])).rows[0].id as string;
  const awa = await ins(jeu.entreprises.A1, "A-1", "+24177100001");
  const collegue = await ins(jeu.entreprises.A1, "A-2", "+24177100002");
  const compteAwa = await creerCompte(client, { phone: "24177100001" });
  await client.query("select public.rattacher_compte_salarie('+24177100001', $1)", [compteAwa]);

  const rhA = await creerCompte(client, { email: `rha-${randomUUID().slice(0, 6)}@test.e-paie.local` });
  const rhB = await creerCompte(client, { email: `rhb-${randomUUID().slice(0, 6)}@test.e-paie.local` });
  await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'rh'), ($3, $4, 'rh')", [
    jeu.entreprises.A1, rhA, jeu.entreprises.B1, rhB,
  ]);
  const types = async (e: string) =>
    Object.fromEntries((await client.query("select libelle, id from public.types_absence where entreprise_id = $1", [e])).rows.map((r) => [r.libelle, r.id]));
  const typesA = await types(jeu.entreprises.A1);
  // Lundi dans deux semaines (dates stables pour le décompte des jours)
  const lundi = (await client.query("select (date_trunc('week', current_date) + interval '14 days')::date::text as d")).rows[0].d as string;
  return { awa, collegue, compteAwa, rhA, rhB, conge: typesA["Congé payé"] as string, mariage: typesA["Permission : mariage du salarié"] as string, lundi };
}

const plus = (date: string, jours: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
};
const DEMANDER = "select public.demander_absence($1, $2, $3, $4, $5, $6, $7, $8) as id";

describe("Demandes du salarié", () => {
  test("le salarié demande un congé : jours ouvrables décomptés, jours fériés exclus, demi-journée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await client.query("insert into public.jours_feries (entreprise_id, jour, libelle) values ($1, $2, 'Férié test')", [jeu.entreprises.A1, plus(d.lundi, 2)]);
      await commeUtilisateur(client, d.compteAwa);
      // Lundi → dimanche : 6 jours ouvrables − 1 férié − une demi-journée le premier jour = 4,5
      const { rows } = await client.query(DEMANDER, [d.awa, d.conge, d.lundi, plus(d.lundi, 6), true, false, "Vacances", null]);
      const { rows: mes } = await client.query("select id, nb_jours, statut from public.mes_demandes_absence()");
      expect(mes).toEqual([{ id: rows[0].id, nb_jours: "4.5", statut: "en_attente" }]);
      const { rows: solde } = await client.query("select en_attente from public.mon_solde_conges($1)", [d.awa]);
      expect(solde[0].en_attente).toBe("4.5");
    }));

  test("impossible de demander pour un collègue, ni de lire les tables, ni de chevaucher une absence", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      expect(await estRefusee(client, DEMANDER, [d.collegue, d.conge, d.lundi, d.lundi, false, false, null, null])).toBe(true);
      await client.query(DEMANDER, [d.awa, d.conge, d.lundi, plus(d.lundi, 4), false, false, null, null]);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.conge, plus(d.lundi, 3), plus(d.lundi, 8), false, false, null, null])).toBe(true);
      for (const table of ["demandes_absence", "types_absence", "soldes_conges_initiaux", "jours_feries"]) {
        expect(await idsVisibles(client, table, table === "soldes_conges_initiaux" ? "salarie_id" : "id"), table).toEqual([]);
      }
      expect((await client.query("select * from public.mon_solde_conges($1)", [d.collegue])).rows).toEqual([]);
    }));

  test("limites des permissions : nombre de jours maximum et justificatif obligatoire", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      const justif = `${jeu.entreprises.A1}/${d.awa}/acte.pdf`;
      expect(await estRefusee(client, DEMANDER, [d.awa, d.mariage, d.lundi, plus(d.lundi, 4), false, false, null, justif])).toBe(true); // 5 j > 3
      expect(await estRefusee(client, DEMANDER, [d.awa, d.mariage, d.lundi, plus(d.lundi, 1), false, false, null, null])).toBe(true); // sans justificatif
      // Justificatif rangé dans le dossier d'un collègue : refusé
      expect(await estRefusee(client, DEMANDER, [d.awa, d.mariage, d.lundi, plus(d.lundi, 1), false, false, null, `${jeu.entreprises.A1}/${d.collegue}/x.pdf`])).toBe(true);
      expect(await estRefusee(client, DEMANDER, [d.awa, d.mariage, d.lundi, plus(d.lundi, 1), false, false, null, justif])).toBe(false);
    }));

  test("justificatifs : le salarié ne dépose et ne voit que dans son propre dossier", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const autre = `${jeu.entreprises.A1}/${d.collegue}/a.pdf`;
      await client.query("insert into storage.objects (bucket_id, name) values ('absences', $1)", [autre]);
      await commeUtilisateur(client, d.compteAwa);
      const sql = "insert into storage.objects (bucket_id, name) values ('absences', $1)";
      expect(await estRefusee(client, sql, [`${jeu.entreprises.A1}/${d.awa}/b.pdf`])).toBe(false);
      expect(await estRefusee(client, sql, [autre.replace("a.pdf", "c.pdf")])).toBe(true);
      expect(await estRefusee(client, sql, [`${jeu.entreprises.B1}/${d.awa}/d.pdf`])).toBe(true);
      expect((await client.query("select name from storage.objects where bucket_id = 'absences'")).rows).toEqual([]);
    }));
});

describe("Traitement par le RH", () => {
  test("seul le RH de l'entreprise traite ; le refus exige un motif ; le solde est mis à jour", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      const id = (await client.query(DEMANDER, [d.awa, d.conge, d.lundi, plus(d.lundi, 1), false, false, null, null])).rows[0].id;

      for (const u of [jeu.utilisateurs.gestionnaireA1, d.rhB, d.compteAwa]) {
        await commeUtilisateur(client, u);
        expect(await estRefusee(client, "select public.decider_demande($1, true)", [id])).toBe(true);
      }
      await commeUtilisateur(client, d.rhA);
      expect(await estRefusee(client, "select public.decider_demande($1, false, 'non')", [id])).toBe(true);
      await client.query("select public.definir_solde_initial($1, current_date, 10)", [d.awa]);
      await client.query("select public.decider_demande($1, true)", [id]);
      const { rows } = await client.query("select solde_initial, pris, disponible from public.soldes_entreprise($1) where salarie_id = $2", [jeu.entreprises.A1, d.awa]);
      expect(rows).toEqual([{ solde_initial: "10.00", pris: "2.0", disponible: "8.00" }]);
    }));

  test("« À faire » : le RH voit la demande, pas l'administrateur ; sans RH, l'administrateur la voit", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compteAwa);
      const id = (await client.query(DEMANDER, [d.awa, d.conge, d.lundi, d.lundi, false, false, null, null])).rows[0].id;
      const aTraiter = async (u: string) => {
        await commeUtilisateur(client, u);
        return (await client.query("select demande_id from public.mes_demandes_a_traiter()")).rows.map((r) => r.demande_id);
      };
      expect(await aTraiter(d.rhA)).toEqual([id]);
      expect(await aTraiter(jeu.utilisateurs.adminCabinetA)).toEqual([]);
      expect(await aTraiter(d.rhB)).toEqual([]);
      await client.query("reset role");
      await client.query("delete from public.affectations where profil_id = $1", [d.rhA]);
      expect(await aTraiter(jeu.utilisateurs.adminCabinetA)).toEqual([id]);
      expect(await aTraiter(jeu.utilisateurs.adminCabinetB)).toEqual([]);
    }));

  test("réglages et données réservés : types, fériés et coordonnées pour les alertes", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, "insert into public.types_absence (entreprise_id, libelle, nature) values ($1, 'Piège', 'autre')", [jeu.entreprises.A1])).toBe(true);
      await commeUtilisateur(client, d.rhB);
      expect(await estRefusee(client, "insert into public.jours_feries (entreprise_id, jour, libelle) values ($1, current_date, 'Piège')", [jeu.entreprises.A1])).toBe(true);
      expect(await idsVisibles(client, "types_absence")).not.toContain(d.conge);
      await commeUtilisateur(client, d.rhA);
      expect(await estRefusee(client, "insert into public.types_absence (entreprise_id, libelle, nature) values ($1, 'Formation', 'autre')", [jeu.entreprises.A1])).toBe(false);
      for (const sql of ["select * from public.destinataires_demande_absence($1)", "select * from public.infos_decision_absence($1)"]) {
        expect(await estRefusee(client, sql, [randomUUID()])).toBe(true);
      }
    }));
});
