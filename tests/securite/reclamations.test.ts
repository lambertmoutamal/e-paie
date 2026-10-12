import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

async function compte(client: pg.Client, champs: { email?: string; phone?: string }) {
  await client.query("reset role");
  const id = randomUUID();
  await client.query("insert into auth.users (id, email, phone, aud, role) values ($1, $2, $3, 'authenticated', 'authenticated')", [id, champs.email ?? null, champs.phone ?? null]);
  return id;
}

// A1 : Awa (compte salarié), un collègue, un RH ; le gestionnaire de paie du jeu de données.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const ins = async (m: string, tel: string) =>
    (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, telephone) values ($1, $2, 'N', 'P', '2024-01-01', $3) returning id", [jeu.entreprises.A1, m, tel])).rows[0].id as string;
  const awa = await ins("A-1", "+24177300001");
  const collegue = await ins("A-2", "+24177300002");
  const compteAwa = await compte(client, { phone: "24177300001" });
  await client.query("select public.rattacher_compte_salarie('+24177300001', $1)", [compteAwa]);
  const rh = await compte(client, { email: `rh-${randomUUID().slice(0, 6)}@test.e-paie.local` });
  await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'rh')", [jeu.entreprises.A1, rh]);
  return { awa, collegue, compteAwa, rh };
}

const OUVRIR = "select public.ouvrir_reclamation($1, $2, $3, $4, null, $5) as id";
const REPONDRE = "select public.ajouter_message_reclamation($1, $2, null, null, $3) as statut";

async function ouvrir(client: pg.Client, d: Awaited<ReturnType<typeof preparer>>, sujet: string) {
  await commeUtilisateur(client, d.compteAwa);
  return (await client.query(OUVRIR, [d.awa, sujet, "Prime absente", "Il manque ma prime de transport.", null])).rows[0].id as string;
}
const aTraiter = async (client: pg.Client, u: string) => {
  await commeUtilisateur(client, u);
  return (await client.query("select reclamation_id from public.mes_reclamations_a_traiter()")).rows.map((r) => r.reclamation_id);
};

describe("Réclamations du salarié", () => {
  test("le salarié n'ouvre et ne voit que ses réclamations ; aucune lecture directe des tables", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const id = await ouvrir(client, d, "bulletin");
      expect(await estRefusee(client, OUVRIR, [d.collegue, "bulletin", "Piège", "x", null])).toBe(true);
      // Pièce jointe rangée dans le dossier d'un collègue : refusée
      expect(await estRefusee(client, OUVRIR, [d.awa, "autre", "Pièce", "x", `${jeu.entreprises.A1}/${d.collegue}/a.pdf`])).toBe(true);
      expect((await client.query("select id from public.mes_reclamations()")).rows).toEqual([{ id }]);
      expect(await idsVisibles(client, "reclamations")).toEqual([]);
      expect(await idsVisibles(client, "messages_reclamation")).toEqual([]);
      expect(await estRefusee(client, REPONDRE, [id, "Je résous moi-même", true])).toBe(true);
    }));
});

describe("Traitement selon le sujet", () => {
  test("bulletin → gestionnaire de paie ; congés → RH ; chacun ne voit que son sujet", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const bulletin = await ouvrir(client, d, "bulletin");
      const conges = await ouvrir(client, d, "conges");

      expect(await aTraiter(client, jeu.utilisateurs.gestionnaireA1)).toEqual([bulletin]);
      expect(await idsVisibles(client, "reclamations")).toEqual([bulletin]);
      expect(await aTraiter(client, d.rh)).toEqual([conges]);
      expect(await idsVisibles(client, "reclamations")).toEqual([conges]);
      // L'administrateur voit tout, mais n'a rien « à faire » : chaque sujet a son responsable
      expect(await aTraiter(client, jeu.utilisateurs.adminCabinetA)).toEqual([]);
      expect((await idsVisibles(client, "reclamations")).sort()).toEqual([bulletin, conges].sort());
      // Le gestionnaire ne peut pas répondre sur un sujet RH
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, REPONDRE, [conges, "Réponse", false])).toBe(true);
    }));

  test("une autre entreprise, un contrôleur ou un visiteur ne voient rien", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const id = await ouvrir(client, d, "conges");
      const controleur = await compte(client, { email: `c-${randomUUID().slice(0, 6)}@test.e-paie.local` });
      await client.query("reset role");
      await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'controleur')", [jeu.entreprises.A1, controleur]);
      for (const u of [jeu.utilisateurs.gestionnaireB1, jeu.utilisateurs.adminCabinetB, controleur]) {
        await commeUtilisateur(client, u);
        expect(await idsVisibles(client, "reclamations")).toEqual([]);
        expect(await estRefusee(client, REPONDRE, [id, "Piège", false])).toBe(true);
      }
      for (const sql of ["select * from public.destinataires_reclamation($1)", "select * from public.infos_reponse_reclamation($1)"]) {
        expect(await estRefusee(client, sql, [id])).toBe(true);
      }
    }));
});

describe("Échanges et résolution", () => {
  test("réponse, relance, résolution par l'entreprise puis clôture par le salarié", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const id = await ouvrir(client, d, "conges");

      await commeUtilisateur(client, d.rh);
      expect((await client.query(REPONDRE, [id, "Nous vérifions.", false])).rows[0].statut).toBe("en_cours");
      expect(await aTraiter(client, d.rh)).toEqual([]); // attend maintenant le salarié

      await commeUtilisateur(client, d.compteAwa);
      await client.query(REPONDRE, [id, "Merci, j'attends.", false]);
      expect(await aTraiter(client, d.rh)).toEqual([id]);

      await commeUtilisateur(client, d.rh);
      expect((await client.query(REPONDRE, [id, "Corrigé sur le bulletin de novembre.", true])).rows[0].statut).toBe("resolue");

      await commeUtilisateur(client, d.compteAwa);
      expect((await client.query("select count(*)::int as n from public.messages_de_ma_reclamation($1)", [id])).rows[0].n).toBe(4);
      await client.query("select public.cloturer_ma_reclamation($1)", [id]);
      expect(await estRefusee(client, REPONDRE, [id, "Encore une chose", false])).toBe(true);
    }));
});
