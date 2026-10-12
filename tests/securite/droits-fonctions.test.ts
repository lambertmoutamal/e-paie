import { afterAll, describe, expect, test } from "vitest";
import { dansUneTransaction, fermerConnexion } from "./outils";

afterAll(fermerConnexion);

// Fonctions qui manipulent des coordonnées ou de l'argent : réservées au serveur.
// Supabase accorde par défaut l'exécution aux utilisateurs connectés ; ce test
// vérifie que ce droit a bien été retiré partout.
const RESERVEES_AU_SERVEUR = [
  "appliquer_paiement",
  "destinataires_alerte",
  "destinataires_demande_absence",
  "destinataires_reclamation",
  "infos_decision_absence",
  "infos_reponse_reclamation",
  "rattacher_compte_salarie",
  "reserver_envoi_email",
  "salarie_connu",
];

describe("Droits sur les fonctions de la base", () => {
  test("aucune fonction n'est accessible à un visiteur non connecté", () =>
    dansUneTransaction(async (client) => {
      const { rows } = await client.query(`
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')`);
      expect(rows.map((r) => r.proname)).toEqual([]);
    }));

  test("les fonctions sensibles sont réservées au serveur", () =>
    dansUneTransaction(async (client) => {
      const { rows } = await client.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = any($1) and has_function_privilege('authenticated', p.oid, 'execute')`,
        [RESERVEES_AU_SERVEUR],
      );
      expect(rows.map((r) => r.proname)).toEqual([]);
    }));
});
