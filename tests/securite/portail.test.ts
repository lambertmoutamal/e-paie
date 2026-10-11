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

const TEL_AWA = "+24177000001";

// A1 : Awa (téléphone connu) et un collègue ; une période publiée et une approuvée (non publiée).
// B1 : un salarié avec le même numéro qu'Awa n'existe pas ; un autre salarié et sa période publiée.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const ins = async (entreprise: string, matricule: string, telephone: string | null) =>
    (
      await client.query(
        "insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, telephone) values ($1, $2, 'N', 'P', '2024-01-01', $3) returning id",
        [entreprise, matricule, telephone],
      )
    ).rows[0].id as string;
  const awa = await ins(jeu.entreprises.A1, "A-1", TEL_AWA);
  const collegue = await ins(jeu.entreprises.A1, "A-2", "+24177000002");
  const salarieB = await ins(jeu.entreprises.B1, "B-1", "+24177000003");

  const periode = async (entreprise: string, mois: number, statut: string) =>
    (
      await client.query("insert into public.periodes_paie (entreprise_id, annee, mois, statut) values ($1, 2026, $2, $3) returning id", [
        entreprise,
        mois,
        statut,
      ])
    ).rows[0].id as string;
  const publieeA = await periode(jeu.entreprises.A1, 9, "publiee");
  const approuveeA = await periode(jeu.entreprises.A1, 10, "approuvee");
  const publieeB = await periode(jeu.entreprises.B1, 9, "publiee");

  const bulletins: Record<string, { id: string; chemin: string }> = {};
  for (const [cle, entreprise, per, sal] of [
    ["awaPublie", jeu.entreprises.A1, publieeA, awa],
    ["awaNonPublie", jeu.entreprises.A1, approuveeA, awa],
    ["collegue", jeu.entreprises.A1, publieeA, collegue],
    ["autreEntreprise", jeu.entreprises.B1, publieeB, salarieB],
  ] as const) {
    const chemin = `${entreprise}/${per}/${sal}-${randomUUID()}.pdf`;
    const { rows } = await client.query(
      `insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256)
       values ($1, $2, $3, $4, 'b.pdf', 100, $5) returning id`,
      [entreprise, per, sal, chemin, "a".repeat(64)],
    );
    await client.query("insert into storage.objects (bucket_id, name) values ('bulletins', $1)", [chemin]);
    bulletins[cle] = { id: rows[0].id, chemin };
  }

  // Compte du salarié (créé par le serveur après vérification du code)
  const compte = randomUUID();
  await client.query("insert into auth.users (id, phone, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [compte, TEL_AWA.slice(1)]);
  await client.query("select public.rattacher_compte_salarie($1, $2)", [TEL_AWA, compte]);
  return { awa, collegue, compte, publieeA, approuveeA, bulletins };
}

describe("Portail salarié : isolation", () => {
  test("le salarié ne voit que ses propres bulletins, et seulement publiés", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compte, { app_metadata: { type: "salarie" } });

      const { rows } = await client.query("select bulletin_id, annee, mois from public.mes_bulletins()");
      expect(rows).toEqual([{ bulletin_id: d.bulletins.awaPublie.id, annee: 2026, mois: 9 }]);
      const { rows: emplois } = await client.query("select salarie_id, raison_sociale from public.mes_emplois()");
      expect(emplois).toEqual([{ salarie_id: d.awa, raison_sociale: "Entreprise A1" }]);
    }));

  test("aucune lecture directe des tables, ni des fichiers des autres", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, d.compte);
      for (const table of ["salaries", "bulletins", "periodes_paie", "entreprises", "validations_periode", "contrats", "documents_salarie"]) {
        expect(await idsVisibles(client, table), table).toEqual([]);
      }
      const { rows } = await client.query("select name from storage.objects where bucket_id = 'bulletins'");
      expect(rows.map((r) => r.name)).toEqual([d.bulletins.awaPublie.chemin]);

      const chemin = async (id: string) => (await client.query("select public.fichier_de_mon_bulletin($1) as c", [id])).rows[0].c;
      expect(await chemin(d.bulletins.awaPublie.id)).toBe(d.bulletins.awaPublie.chemin);
      expect(await chemin(d.bulletins.awaNonPublie.id)).toBeNull();
      expect(await chemin(d.bulletins.collegue.id)).toBeNull();
      expect(await chemin(d.bulletins.autreEntreprise.id)).toBeNull();
    }));

  test("abonnement bloqué : le salarié n'a plus accès à rien", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await client.query(
        `insert into public.abonnements (cabinet_id, formule_id, statut, debut, fin)
         select $1, f.id, 'essai', now() - interval '120 days', now() - interval '40 days' from public.formules f where f.code = 'essai'`,
        [jeu.cabinets.A],
      );
      await commeUtilisateur(client, d.compte);
      expect((await client.query("select * from public.mes_bulletins()")).rows).toEqual([]);
      expect((await client.query("select name from storage.objects where bucket_id = 'bulletins'")).rows).toEqual([]);
    }));
});

describe("Rattachement du compte", () => {
  test("un employeur ne peut pas rattacher une fiche à un compte, et changer le numéro détache le compte", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const g = jeu.utilisateurs.gestionnaireA1;
      await commeUtilisateur(client, g);
      expect(await estRefusee(client, "update public.salaries set profil_id = $1 where id = $2", [g, d.collegue])).toBe(true);
      // Les fonctions réservées au serveur sont inaccessibles
      expect(await estRefusee(client, "select public.rattacher_compte_salarie($1, $2)", ["+24177000002", g])).toBe(true);
      expect(await estRefusee(client, "select public.salarie_connu($1)", [TEL_AWA])).toBe(true);

      await client.query("update public.salaries set telephone = '+24166999999' where id = $1", [d.awa]);
      await client.query("reset role");
      const { rows } = await client.query("select profil_id from public.salaries where id = $1", [d.awa]);
      expect(rows[0].profil_id).toBeNull();
      await commeUtilisateur(client, d.compte);
      expect((await client.query("select * from public.mes_bulletins()")).rows).toEqual([]);
    }));

  test("un visiteur non connecté ne peut rien appeler", () =>
    dansUneTransaction(async (client) => {
      await commeUtilisateur(client, null);
      expect(await estRefusee(client, "select * from public.mes_bulletins()")).toBe(true);
      expect(await estRefusee(client, "select public.salarie_connu($1)", [TEL_AWA])).toBe(true);
    }));
});

describe("Publication", () => {
  test("seuls les administrateurs et le signataire publient, et seulement une période approuvée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      const publier = "select public.publier_periode($1)";

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, publier, [d.approuveeA])).toBe(true);
      await commeUtilisateur(client, jeu.utilisateurs.adminCabinetB);
      expect(await estRefusee(client, publier, [d.approuveeA])).toBe(true);

      await client.query("reset role");
      const brouillon = (await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 11) returning id", [jeu.entreprises.A1])).rows[0].id;
      const signataire = randomUUID();
      await client.query("insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [signataire, `${signataire.slice(0, 8)}@test.e-paie.local`]);
      await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'signataire')", [jeu.entreprises.A1, signataire]);

      await commeUtilisateur(client, signataire);
      expect(await estRefusee(client, publier, [brouillon])).toBe(true);
      // (la vérification ci-dessus est annulée après coup : on publie pour de bon)
      expect(await estRefusee(client, publier, [d.approuveeA])).toBe(false);
      await client.query(publier, [d.approuveeA]);

      // Le salarié voit maintenant aussi le bulletin d'octobre
      await commeUtilisateur(client, d.compte);
      const { rows } = await client.query("select mois from public.mes_bulletins()");
      expect(rows.map((r) => r.mois)).toEqual([10, 9]);
    }));
});
