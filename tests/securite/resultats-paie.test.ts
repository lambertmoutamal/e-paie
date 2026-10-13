import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion, idsVisibles, type JeuDeDonnees } from "./outils";

afterAll(fermerConnexion);

// A1 et B1 : un salarié, une période d'octobre en brouillon, un résultat de paie chacun.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const ids: Record<string, string> = {};
  for (const [cle, e, tel] of [["A1", jeu.entreprises.A1, "+24177400001"], ["B1", jeu.entreprises.B1, "+24177400002"]] as const) {
    ids[`salarie${cle}`] = (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche, telephone) values ($1, $2, 'N', 'P', '2024-01-01', $3) returning id", [e, `M-${cle}`, tel])).rows[0].id;
    ids[`periode${cle}`] = (await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 10) returning id", [e])).rows[0].id;
    ids[`resultat${cle}`] = (
      await client.query("insert into public.resultats_paie (entreprise_id, periode_id, salarie_id, brut, net_a_payer) values ($1, $2, $3, 500000, 410000) returning id", [e, ids[`periode${cle}`], ids[`salarie${cle}`]])
    ).rows[0].id;
  }
  return ids;
}

const IMPORT = "insert into public.resultats_paie (entreprise_id, periode_id, salarie_id, brut, importe_par) values ($1, $2, $3, 1, $4)";

describe("Résultats de paie importés", () => {
  test("chaque entreprise ne voit que ses résultats ; le salarié n'en voit aucun", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await idsVisibles(client, "resultats_paie")).toEqual([d.resultatA1]);

      const compte = randomUUID();
      await client.query("reset role");
      await client.query("insert into auth.users (id, phone, aud, role) values ($1, '24177400001', 'authenticated', 'authenticated')", [compte]);
      await client.query("select public.rattacher_compte_salarie('+24177400001', $1)", [compte]);
      await commeUtilisateur(client, compte);
      expect(await idsVisibles(client, "resultats_paie")).toEqual([]);
    }));

  test("import impossible pour une autre entreprise, un salarié d'ailleurs, ou au nom d'un autre", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await client.query("reset role");
      await client.query("delete from public.resultats_paie where id = $1", [d.resultatA1]);
      const g = jeu.utilisateurs.gestionnaireA1;
      await commeUtilisateur(client, g);
      expect(await estRefusee(client, IMPORT, [jeu.entreprises.B1, d.periodeB1, d.salarieB1, g])).toBe(true);
      expect(await estRefusee(client, IMPORT, [jeu.entreprises.A1, d.periodeA1, d.salarieB1, g])).toBe(true);
      expect(await estRefusee(client, IMPORT, [jeu.entreprises.A1, d.periodeA1, d.salarieA1, jeu.utilisateurs.adminCabinetA])).toBe(true);
      expect(await estRefusee(client, IMPORT, [jeu.entreprises.A1, d.periodeA1, d.salarieA1, g])).toBe(false);
    }));

  test("le contrôleur consulte sans modifier ; une période validée est verrouillée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const d = await preparer(client, jeu);
      await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'controleur')", [jeu.entreprises.A1, jeu.utilisateurs.sansAffectation]);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);
      expect(await idsVisibles(client, "resultats_paie")).toEqual([d.resultatA1]);
      expect((await client.query("update public.resultats_paie set brut = 1 where id = $1", [d.resultatA1])).rowCount).toBe(0);

      await client.query("reset role");
      await client.query("update public.periodes_paie set statut = 'en_validation' where id = $1", [d.periodeA1]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect((await client.query("delete from public.resultats_paie where id = $1", [d.resultatA1])).rowCount).toBe(0);
      expect((await client.query("update public.resultats_paie set brut = 1, importe_par = $2 where id = $1", [d.resultatA1, jeu.utilisateurs.gestionnaireA1])).rowCount).toBe(0);
    }));
});
