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

// Un salarié en A1 et un en B1, chacun avec un CDD en cours se terminant dans 10 jours.
async function preparer(client: pg.Client, jeu: JeuDeDonnees) {
  await client.query("reset role");
  const { rows: s } = await client.query(
    `insert into public.salaries (entreprise_id, matricule, nom, prenoms, date_embauche)
     values ($1, 'A-1', 'NDONG', 'Awa', current_date - 100), ($2, 'B-1', 'MBA', 'Paul', current_date - 100)
     returning id, entreprise_id`,
    [jeu.entreprises.A1, jeu.entreprises.B1],
  );
  const salarieA1 = s.find((r) => r.entreprise_id === jeu.entreprises.A1).id as string;
  const salarieB1 = s.find((r) => r.entreprise_id === jeu.entreprises.B1).id as string;
  const { rows: c } = await client.query(
    `insert into public.contrats (entreprise_id, salarie_id, type_contrat, poste, salaire_base, date_debut, date_fin_prevue)
     values ($1, $2, 'cdd', 'Comptable', 350000, current_date - 100, current_date + 10),
            ($3, $4, 'cdd', 'Chauffeur', 200000, current_date - 100, current_date + 10)
     returning id, entreprise_id`,
    [jeu.entreprises.A1, salarieA1, jeu.entreprises.B1, salarieB1],
  );
  const contratA1 = c.find((r) => r.entreprise_id === jeu.entreprises.A1).id as string;
  const contratB1 = c.find((r) => r.entreprise_id === jeu.entreprises.B1).id as string;
  return { salarieA1, salarieB1, contratA1, contratB1 };
}

const NOUVEAU_CONTRAT =
  "insert into public.contrats (entreprise_id, salarie_id, type_contrat, date_debut) values ($1, $2, 'cdi', current_date)";

describe("Isolation des contrats", () => {
  test("un gestionnaire ne voit que les contrats (et salaires) de son entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { contratA1, contratB1 } = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const visibles = await idsVisibles(client, "contrats");
      expect(visibles).toEqual([contratA1]);
      expect(visibles).not.toContain(contratB1);
    }));

  test("impossible de créer un contrat pour un salarié d'une autre entreprise, même en trichant sur l'entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieB1 } = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      // Entreprise A1 (autorisée) mais salarié de B1 : refusé par le contrôle de rattachement
      expect(await estRefusee(client, NOUVEAU_CONTRAT, [jeu.entreprises.A1, salarieB1])).toBe(true);
      expect(await estRefusee(client, NOUVEAU_CONTRAT, [jeu.entreprises.B1, salarieB1])).toBe(true);
    }));

  test("un avenant ne peut pas être rattaché au contrat d'un autre salarié", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1, contratB1 } = await preparer(client, jeu);
      await client.query("reset role");
      expect(
        await estRefusee(
          client,
          `insert into public.contrats (entreprise_id, salarie_id, contrat_parent_id, nature, type_contrat, date_debut)
           values ($1, $2, $3, 'avenant', 'cdd', current_date)`,
          [jeu.entreprises.A1, salarieA1, contratB1],
        ),
      ).toBe(true);
    }));

  test("le contrôleur consulte les contrats mais ne les modifie pas", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { contratA1 } = await preparer(client, jeu);
      await client.query("insert into public.affectations (entreprise_id, profil_id, role) values ($1, $2, 'controleur')", [
        jeu.entreprises.A1,
        jeu.utilisateurs.sansAffectation,
      ]);
      await commeUtilisateur(client, jeu.utilisateurs.sansAffectation);
      expect(await idsVisibles(client, "contrats")).toEqual([contratA1]);
      expect((await client.query("update public.contrats set salaire_base = 1 where id = $1", [contratA1])).rowCount).toBe(0);
    }));
});

describe("Règles des contrats", () => {
  test("un seul contrat principal en cours par salarié", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1 } = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(await estRefusee(client, NOUVEAU_CONTRAT, [jeu.entreprises.A1, salarieA1])).toBe(true);
    }));

  test("un CDD sans date de fin est refusé", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1, contratA1 } = await preparer(client, jeu);
      await client.query("reset role");
      await client.query("update public.contrats set statut = 'termine', date_fin_effective = current_date where id = $1", [contratA1]);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(
        await estRefusee(
          client,
          "insert into public.contrats (entreprise_id, salarie_id, type_contrat, date_debut) values ($1, $2, 'cdd', current_date)",
          [jeu.entreprises.A1, salarieA1],
        ),
      ).toBe(true);
    }));

  test("le poste du contrat en cours devient le poste du salarié", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1, contratA1 } = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      await client.query("update public.contrats set poste = 'Chef comptable' where id = $1", [contratA1]);
      const { rows } = await client.query("select poste from public.salaries where id = $1", [salarieA1]);
      expect(rows[0].poste).toBe("Chef comptable");
    }));
});

describe("Échéances", () => {
  test("la fin de CDD dans 10 jours apparaît, uniquement pour les entreprises accessibles", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { contratA1 } = await preparer(client, jeu);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const { rows } = await client.query("select contrat_id, nature, jours_restants from public.echeances_contrats(30)");
      expect(rows).toEqual([{ contrat_id: contratA1, nature: "fin_contrat", jours_restants: 10 }]);

      const { rows: proches } = await client.query("select * from public.echeances_contrats(5)");
      expect(proches).toEqual([]);
    }));
});

describe("Documents et fichiers", () => {
  test("les fiches documents et les fichiers stockés sont isolés par entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      const { salarieA1, salarieB1 } = await preparer(client, jeu);
      await client.query("reset role");
      const cheminA = `${jeu.entreprises.A1}/${salarieA1}/test-a.pdf`;
      const cheminB = `${jeu.entreprises.B1}/${salarieB1}/test-b.pdf`;
      await client.query(
        `insert into public.documents_salarie (entreprise_id, salarie_id, categorie, libelle, fichier_chemin, fichier_nom, taille, type_mime)
         values ($1, $2, 'identite', 'CNI', $3, 'a.pdf', 10, 'application/pdf'), ($4, $5, 'identite', 'CNI', $6, 'b.pdf', 10, 'application/pdf')`,
        [jeu.entreprises.A1, salarieA1, cheminA, jeu.entreprises.B1, salarieB1, cheminB],
      );
      await client.query("insert into storage.objects (bucket_id, name) values ('documents', $1), ('documents', $2)", [cheminA, cheminB]);

      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      const { rows: docs } = await client.query("select fichier_chemin from public.documents_salarie");
      expect(docs.map((d) => d.fichier_chemin)).toEqual([cheminA]);
      const { rows: fichiers } = await client.query("select name from storage.objects where bucket_id = 'documents'");
      expect(fichiers.map((f) => f.name)).toEqual([cheminA]);
    }));

  test("impossible de déposer un fichier dans le dossier d'une autre entreprise", () =>
    dansUneTransaction(async (client) => {
      const jeu = await creerJeuDeDonnees(client);
      await commeUtilisateur(client, jeu.utilisateurs.gestionnaireA1);
      expect(
        await estRefusee(client, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [
          `${jeu.entreprises.B1}/x/piege.pdf`,
        ]),
      ).toBe(true);
      expect(
        await estRefusee(client, "insert into storage.objects (bucket_id, name) values ('documents', 'pas-un-uuid/x.pdf')"),
      ).toBe(true);
    }));
});
