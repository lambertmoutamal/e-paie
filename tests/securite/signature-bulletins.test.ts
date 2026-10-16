import { afterAll, describe, expect, test } from "vitest";
import { commeUtilisateur, creerJeuDeDonnees, dansUneTransaction, estRefusee, fermerConnexion } from "./outils";

afterAll(fermerConnexion);

describe("Version signée des bulletins", () => {
  test("ni le déposant ni un administrateur ne peuvent poser ou changer la version signée", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await client.query("reset role");
      const s = (await client.query("insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche) values ($1, 'SIG-1', 'N', 'P', '2024-01-01') returning id", [jeu.entreprises.A1])).rows[0].id;
      const p = (await client.query("insert into public.periodes_paie (entreprise_id, annee, mois) values ($1, 2026, 10) returning id", [jeu.entreprises.A1])).rows[0].id;
      const b = (
        await client.query(
          "insert into public.bulletins (entreprise_id, periode_id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256) values ($1, $2, $3, $4, 'b.pdf', 1, repeat('a', 64)) returning id",
          [jeu.entreprises.A1, p, s, `${jeu.entreprises.A1}/${p}/x.pdf`],
        )
      ).rows[0].id;

      for (const utilisateur of [jeu.utilisateurs.gestionnaireA1, jeu.utilisateurs.adminCabinetA]) {
        await commeUtilisateur(client, utilisateur);
        expect(await estRefusee(client, "update public.bulletins set fichier_signe_chemin = 'faux.pdf' where id = $1", [b])).toBe(true);
        expect(await estRefusee(client, "update public.bulletins set signe_le = now() where id = $1", [b])).toBe(true);
      }
    }));
});
