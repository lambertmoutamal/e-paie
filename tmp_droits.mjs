import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r1 = await c.query(`select e.raison_sociale, prive.phase_entreprise(e.id) as phase, (select count(*) from public.salaries s where s.entreprise_id = e.id) as nb from public.entreprises e order by 1`);
console.table(r1.rows);
const r2 = await c.query(`select p.email, p.est_admin_plateforme as admin_plateforme,
  (select string_agg(c.nom, ', ') from public.membres_cabinet m join public.cabinets c on c.id = m.cabinet_id where m.profil_id = p.id) as cabinets,
  (select string_agg(e.raison_sociale || ' : ' || a.role::text, ' | ') from public.affectations a join public.entreprises e on e.id = a.entreprise_id where a.profil_id = p.id and a.actif) as roles
  from public.profils p where p.email is not null order by p.email`);
console.table(r2.rows.map((x) => ({ ...x, email: x.email.replace(/^(.{3}).*(@.*)$/, "$1…$2") })));
await c.end();
