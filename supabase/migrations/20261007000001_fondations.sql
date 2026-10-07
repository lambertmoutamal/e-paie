-- =====================================================================
-- Étape 2 : fondations multi-clients et isolation par entreprise (RLS)
-- =====================================================================
-- Principe : chaque table est protégée par la Row Level Security.
-- La base refuse elle-même toute ligne que l'utilisateur n'a pas le droit
-- de voir, même si le code de l'application contient une erreur.

-- Schéma privé pour les fonctions de contrôle d'accès (non exposé par l'API)
create schema if not exists prive;
revoke all on schema prive from public;
grant usage on schema prive to authenticated;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.mode_entreprise as enum ('cabinet', 'autonome');
create type public.statut_entreprise as enum ('active', 'archivee');
create type public.role_entreprise as enum ('gestionnaire_paie', 'controleur', 'signataire', 'rh');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Une ligne par compte (personnel ou salarié), liée à l'authentification Supabase
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_complet text not null default '',
  email text,
  telephone text unique,
  est_admin_plateforme boolean not null default false,
  cree_le timestamptz not null default now()
);

create table public.cabinets (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) > 0),
  nif text,
  telephone text,
  email text,
  adresse text,
  cree_le timestamptz not null default now()
);

create table public.membres_cabinet (
  cabinet_id uuid not null references public.cabinets (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  role text not null default 'admin_cabinet' check (role = 'admin_cabinet'),
  cree_le timestamptz not null default now(),
  primary key (cabinet_id, profil_id)
);
create index membres_cabinet_profil_idx on public.membres_cabinet (profil_id);

-- cabinet_id vide = entreprise autonome ou ayant quitté son cabinet
create table public.entreprises (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid references public.cabinets (id) on delete restrict,
  raison_sociale text not null check (length(trim(raison_sociale)) > 0),
  nif text,
  rccm text,
  numero_cnss text,
  adresse text,
  telephone text,
  email text,
  mode public.mode_entreprise not null default 'cabinet',
  autoriser_auto_validation boolean not null default false,
  statut public.statut_entreprise not null default 'active',
  cree_le timestamptz not null default now()
);
create index entreprises_cabinet_idx on public.entreprises (cabinet_id);

-- Qui travaille sur quelle entreprise, avec quel rôle
create table public.affectations (
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  profil_id uuid not null references public.profils (id) on delete cascade,
  role public.role_entreprise not null,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  primary key (entreprise_id, profil_id, role)
);
create index affectations_profil_idx on public.affectations (profil_id);

-- ---------------------------------------------------------------------
-- Fonctions de contrôle d'accès
-- (security definer : elles lisent les tables sans repasser par la RLS,
--  ce qui évite les boucles ; elles ne renvoient que vrai/faux)
-- ---------------------------------------------------------------------

create function prive.est_admin_plateforme()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.est_admin_plateforme from public.profils p where p.id = (select auth.uid())),
    false
  )
$$;

create function prive.est_admin_cabinet(p_cabinet_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membres_cabinet m
    where m.cabinet_id = p_cabinet_id
      and m.profil_id = (select auth.uid())
  )
$$;

-- Administrateur plateforme, ou administrateur du cabinet de l'entreprise
create function prive.gere_entreprise(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.est_admin_plateforme()
    or exists (
      select 1
      from public.entreprises e
      join public.membres_cabinet m on m.cabinet_id = e.cabinet_id
      where e.id = p_entreprise_id
        and m.profil_id = (select auth.uid())
    )
$$;

-- Toute personne autorisée à voir les données de l'entreprise
create function prive.a_acces_entreprise(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.gere_entreprise(p_entreprise_id)
    or exists (
      select 1 from public.affectations a
      where a.entreprise_id = p_entreprise_id
        and a.profil_id = (select auth.uid())
        and a.actif
    )
$$;

-- L'utilisateur a-t-il l'un de ces rôles dans l'entreprise ?
create function prive.a_role_entreprise(p_entreprise_id uuid, p_roles public.role_entreprise[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.affectations a
    where a.entreprise_id = p_entreprise_id
      and a.profil_id = (select auth.uid())
      and a.actif
      and a.role = any (p_roles)
  )
$$;

revoke all on all functions in schema prive from public;
grant execute on function
  prive.est_admin_plateforme(),
  prive.est_admin_cabinet(uuid),
  prive.gere_entreprise(uuid),
  prive.a_acces_entreprise(uuid),
  prive.a_role_entreprise(uuid, public.role_entreprise[])
to authenticated;

-- ---------------------------------------------------------------------
-- Création automatique du profil à chaque nouveau compte
-- ---------------------------------------------------------------------
create function prive.creer_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profils (id, email, telephone, nom_complet)
  values (new.id, new.email, new.phone, coalesce(new.raw_user_meta_data ->> 'nom_complet', ''));
  return new;
end
$$;

create trigger creer_profil_apres_inscription
  after insert on auth.users
  for each row execute function prive.creer_profil();

-- ---------------------------------------------------------------------
-- Droits de base : rien pour les visiteurs non connectés,
-- le strict nécessaire pour les utilisateurs connectés (la RLS filtre ensuite)
-- ---------------------------------------------------------------------
revoke all on public.profils, public.cabinets, public.membres_cabinet,
  public.entreprises, public.affectations from anon, authenticated;

grant select on public.profils to authenticated;
grant update (nom_complet) on public.profils to authenticated;  -- jamais est_admin_plateforme
grant select, insert, update, delete on public.cabinets to authenticated;
grant select, insert, delete on public.membres_cabinet to authenticated;
grant select, insert, update, delete on public.entreprises to authenticated;
grant select, insert, update, delete on public.affectations to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profils enable row level security;
alter table public.cabinets enable row level security;
alter table public.membres_cabinet enable row level security;
alter table public.entreprises enable row level security;
alter table public.affectations enable row level security;

-- Profils : soi-même, l'admin plateforme, et les collègues d'une entreprise accessible
create policy profils_lecture on public.profils for select to authenticated
using (
  id = (select auth.uid())
  or prive.est_admin_plateforme()
  or exists (
    select 1 from public.affectations a
    where a.profil_id = profils.id and prive.a_acces_entreprise(a.entreprise_id)
  )
  or exists (
    select 1 from public.membres_cabinet m
    where m.profil_id = profils.id and prive.est_admin_cabinet(m.cabinet_id)
  )
);

create policy profils_modification on public.profils for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Cabinets
create policy cabinets_lecture on public.cabinets for select to authenticated
using (prive.est_admin_plateforme() or prive.est_admin_cabinet(id));

create policy cabinets_creation on public.cabinets for insert to authenticated
with check (prive.est_admin_plateforme());

create policy cabinets_modification on public.cabinets for update to authenticated
using (prive.est_admin_plateforme() or prive.est_admin_cabinet(id))
with check (prive.est_admin_plateforme() or prive.est_admin_cabinet(id));

create policy cabinets_suppression on public.cabinets for delete to authenticated
using (prive.est_admin_plateforme());

-- Membres de cabinet
create policy membres_cabinet_lecture on public.membres_cabinet for select to authenticated
using (
  profil_id = (select auth.uid())
  or prive.est_admin_plateforme()
  or prive.est_admin_cabinet(cabinet_id)
);

create policy membres_cabinet_ajout on public.membres_cabinet for insert to authenticated
with check (prive.est_admin_plateforme() or prive.est_admin_cabinet(cabinet_id));

create policy membres_cabinet_retrait on public.membres_cabinet for delete to authenticated
using (prive.est_admin_plateforme() or prive.est_admin_cabinet(cabinet_id));

-- Entreprises
create policy entreprises_lecture on public.entreprises for select to authenticated
using (prive.a_acces_entreprise(id));

create policy entreprises_creation on public.entreprises for insert to authenticated
with check (
  prive.est_admin_plateforme()
  or (cabinet_id is not null and prive.est_admin_cabinet(cabinet_id))
);

-- Un admin cabinet ne peut ni déplacer une entreprise vers un autre cabinet,
-- ni la détacher : seul l'admin plateforme le peut.
create policy entreprises_modification on public.entreprises for update to authenticated
using (prive.est_admin_plateforme() or prive.est_admin_cabinet(cabinet_id))
with check (prive.est_admin_plateforme() or prive.est_admin_cabinet(cabinet_id));

create policy entreprises_suppression on public.entreprises for delete to authenticated
using (prive.est_admin_plateforme());

-- Affectations
create policy affectations_lecture on public.affectations for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));

create policy affectations_ajout on public.affectations for insert to authenticated
with check (prive.gere_entreprise(entreprise_id));

create policy affectations_modification on public.affectations for update to authenticated
using (prive.gere_entreprise(entreprise_id))
with check (prive.gere_entreprise(entreprise_id));

create policy affectations_retrait on public.affectations for delete to authenticated
using (prive.gere_entreprise(entreprise_id));
