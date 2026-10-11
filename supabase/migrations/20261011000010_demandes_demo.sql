-- =====================================================================
-- Site vitrine : demandes de démonstration
-- =====================================================================
-- Écrites uniquement par le serveur (formulaire public, avec limite anti-abus),
-- consultées et traitées uniquement par l'administrateur plateforme.

create table public.demandes_demo (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) > 0),
  structure text not null check (length(trim(structure)) > 0),
  type text not null check (type in ('cabinet', 'entreprise', 'autre')),
  email text not null,
  telephone text,
  effectif text,
  message text check (message is null or length(message) <= 2000),
  traitee_le timestamptz,
  cree_le timestamptz not null default now()
);
create index demandes_demo_date_idx on public.demandes_demo (cree_le desc);

revoke all on public.demandes_demo from anon, authenticated;
grant select, update (traitee_le) on public.demandes_demo to authenticated;
alter table public.demandes_demo enable row level security;

create policy demandes_demo_lecture on public.demandes_demo for select to authenticated
using (prive.est_admin_plateforme());
create policy demandes_demo_traitement on public.demandes_demo for update to authenticated
using (prive.est_admin_plateforme()) with check (prive.est_admin_plateforme());

create trigger journaliser after insert or update or delete on public.demandes_demo
  for each row execute function prive.journaliser('', '');
