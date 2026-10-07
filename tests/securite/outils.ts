import { randomUUID } from "node:crypto";
import type pg from "pg";
import { nouvelleConnexion } from "../../scripts/base-de-donnees.mjs";

// Une seule connexion par fichier de tests : s'il faut l'établir à chaque test,
// l'aller-retour Libreville–Paris rend les tests très lents.
let connexion: pg.Client | null = null;

async function client() {
  if (!connexion) {
    const nouvelle = nouvelleConnexion();
    // Coupure réseau : on oublie cette connexion, le test suivant en ouvrira une neuve.
    nouvelle.on("error", () => {
      if (connexion === nouvelle) connexion = null;
    });
    await nouvelle.connect();
    connexion = nouvelle;
  }
  return connexion;
}

export async function fermerConnexion() {
  await connexion?.end();
  connexion = null;
}

// Chaque test travaille dans une transaction annulée à la fin :
// la base de développement n'est jamais modifiée par les tests.
export async function dansUneTransaction(test: (client: pg.Client) => Promise<void>) {
  const c = await client();
  try {
    await c.query("begin");
    await test(c);
  } finally {
    await c.query("rollback").catch(() => {});
  }
}

// Se met dans la peau d'un utilisateur, exactement comme le ferait Supabase
// quand cette personne est connectée. null = visiteur non connecté.
export async function commeUtilisateur(
  client: pg.Client,
  id: string | null,
  autresInfos: Record<string, unknown> = {},
) {
  await client.query("reset role");
  const claims = id ? { sub: id, role: "authenticated", ...autresInfos } : { role: "anon" };
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await client.query(id ? "set local role authenticated" : "set local role anon");
}

// Vérifie qu'une requête est refusée par la base, sans casser la transaction.
export async function estRefusee(client: pg.Client, sql: string, params: unknown[] = []) {
  await client.query("savepoint verification");
  try {
    await client.query(sql, params);
    return false;
  } catch {
    return true;
  } finally {
    await client.query("rollback to savepoint verification");
  }
}

// Jeu de données : deux cabinets, trois entreprises, un utilisateur par situation.
export type JeuDeDonnees = ReturnType<typeof nouveauJeu>;

function nouveauJeu() {
  return {
    utilisateurs: {
      adminPlateforme: randomUUID(),
      adminCabinetA: randomUUID(),
      adminCabinetB: randomUUID(),
      gestionnaireA1: randomUUID(),
      gestionnaireB1: randomUUID(),
      sansAffectation: randomUUID(),
    },
    cabinets: { A: randomUUID(), B: randomUUID() },
    entreprises: { A1: randomUUID(), A2: randomUUID(), B1: randomUUID() },
  };
}

export async function creerJeuDeDonnees(client: pg.Client): Promise<JeuDeDonnees> {
  const jeu = nouveauJeu();
  const u = jeu.utilisateurs;
  const suffixe = randomUUID().slice(0, 8);

  const comptes = Object.entries(u).map(([nom, id]) => ({
    id,
    email: `${nom.toLowerCase()}-${suffixe}@test.e-paie.local`,
    nom,
  }));
  await client.query(
    `insert into auth.users (id, email, aud, role, raw_user_meta_data)
     select c.id, c.email, 'authenticated', 'authenticated', jsonb_build_object('nom_complet', c.nom)
     from jsonb_to_recordset($1::jsonb) as c(id uuid, email text, nom text)`,
    [JSON.stringify(comptes)],
  );

  await client.query("update public.profils set est_admin_plateforme = true where id = $1", [
    u.adminPlateforme,
  ]);
  await client.query(
    "insert into public.cabinets (id, nom) values ($1, 'Cabinet A'), ($2, 'Cabinet B')",
    [jeu.cabinets.A, jeu.cabinets.B],
  );
  await client.query(
    "insert into public.membres_cabinet (cabinet_id, profil_id) values ($1, $2), ($3, $4)",
    [jeu.cabinets.A, u.adminCabinetA, jeu.cabinets.B, u.adminCabinetB],
  );
  await client.query(
    `insert into public.entreprises (id, cabinet_id, raison_sociale) values
       ($1, $2, 'Entreprise A1'), ($3, $2, 'Entreprise A2'), ($4, $5, 'Entreprise B1')`,
    [jeu.entreprises.A1, jeu.cabinets.A, jeu.entreprises.A2, jeu.entreprises.B1, jeu.cabinets.B],
  );
  await client.query(
    `insert into public.affectations (entreprise_id, profil_id, role) values
       ($1, $2, 'gestionnaire_paie'), ($3, $4, 'gestionnaire_paie')`,
    [jeu.entreprises.A1, u.gestionnaireA1, jeu.entreprises.B1, u.gestionnaireB1],
  );
  return jeu;
}

export async function idsVisibles(client: pg.Client, table: string, colonne = "id") {
  const { rows } = await client.query(`select ${colonne} as id from public.${table}`);
  return rows.map((ligne) => ligne.id as string);
}
