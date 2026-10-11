-- =====================================================================
-- Étape 7 : périodes de paie et dépôt des bulletins PDF
-- =====================================================================
-- Dépôt réservé aux administrateurs et au gestionnaire de paie, et seulement
-- tant que la période est en brouillon (le circuit de validation de l'étape 8
-- verrouille ensuite la période). Lecture : personnes ayant accès à l'entreprise.

create type public.statut_periode as enum ('brouillon', 'en_validation', 'approuvee', 'publiee');
create type public.type_bulletin as enum ('normal', 'rectificatif');

create table public.periodes_paie (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  annee integer not null check (annee between 2000 and 2100),
  mois integer not null check (mois between 1 and 12),
  statut public.statut_periode not null default 'brouillon',
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (entreprise_id, annee, mois)
);
create trigger periodes_paie_modifie_le before update on public.periodes_paie
  for each row execute function prive.toucher_modifie_le();

create table public.bulletins (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  periode_id uuid not null references public.periodes_paie (id) on delete restrict,
  salarie_id uuid not null references public.salaries (id) on delete restrict,
  type public.type_bulletin not null default 'normal',
  remplace_bulletin_id uuid references public.bulletins (id) on delete restrict,
  fichier_chemin text not null unique,
  fichier_nom text not null,
  taille integer not null check (taille > 0),
  empreinte_sha256 text not null check (empreinte_sha256 ~ '^[0-9a-f]{64}$'),
  depose_par uuid references public.profils (id) on delete set null,
  depose_le timestamptz not null default now()
);
-- Un seul bulletin « normal » par salarié et par période
create unique index bulletins_un_par_salarie on public.bulletins (periode_id, salarie_id) where type = 'normal';
create index bulletins_salarie_idx on public.bulletins (salarie_id, depose_le desc);

-- ---------------------------------------------------------------------
-- Cohérence : période, salarié et bulletin appartiennent à la même entreprise
-- ---------------------------------------------------------------------
create function prive.verifier_bulletin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.periodes_paie p where p.id = new.periode_id and p.entreprise_id = new.entreprise_id) then
    raise exception 'La période n''appartient pas à cette entreprise.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.salaries s where s.id = new.salarie_id and s.entreprise_id = new.entreprise_id) then
    raise exception 'Le salarié n''appartient pas à cette entreprise.' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and (new.entreprise_id <> old.entreprise_id or new.periode_id <> old.periode_id or new.salarie_id <> old.salarie_id) then
    raise exception 'Le rattachement d''un bulletin ne peut pas être modifié.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
revoke all on function prive.verifier_bulletin() from public;
create trigger bulletins_coherence before insert or update on public.bulletins
  for each row execute function prive.verifier_bulletin();

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------
create function prive.peut_deposer_bulletins(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.gere_entreprise(p_entreprise_id)
    or (
      prive.a_role_entreprise(p_entreprise_id, array['gestionnaire_paie']::public.role_entreprise[])
      and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    )
$$;

create function prive.periode_en_brouillon(p_periode_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.periodes_paie p where p.id = p_periode_id and p.statut = 'brouillon') $$;

revoke all on function prive.peut_deposer_bulletins(uuid) from public;
revoke all on function prive.periode_en_brouillon(uuid) from public;
grant execute on function prive.peut_deposer_bulletins(uuid), prive.periode_en_brouillon(uuid) to authenticated;

create function public.peut_deposer_bulletins(p_entreprise_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.peut_deposer_bulletins(p_entreprise_id) $$;
revoke all on function public.peut_deposer_bulletins(uuid) from public, anon;
grant execute on function public.peut_deposer_bulletins(uuid) to authenticated;

revoke all on public.periodes_paie, public.bulletins from anon, authenticated;
grant select, insert, delete on public.periodes_paie to authenticated;
grant select, insert, update (fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par, depose_le), delete
  on public.bulletins to authenticated;

alter table public.periodes_paie enable row level security;
alter table public.bulletins enable row level security;

create policy periodes_lecture on public.periodes_paie for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy periodes_creation on public.periodes_paie for insert to authenticated
with check (prive.peut_deposer_bulletins(entreprise_id) and statut = 'brouillon' and cree_par = (select auth.uid()));
-- Une période ne se supprime que vide et en brouillon (les bulletins la bloquent).
create policy periodes_suppression on public.periodes_paie for delete to authenticated
using (prive.peut_deposer_bulletins(entreprise_id) and statut = 'brouillon');

create policy bulletins_lecture on public.bulletins for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy bulletins_depot on public.bulletins for insert to authenticated
with check (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id) and depose_par = (select auth.uid()));
create policy bulletins_remplacement on public.bulletins for update to authenticated
using (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id))
with check (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id) and depose_par = (select auth.uid()));
create policy bulletins_retrait on public.bulletins for delete to authenticated
using (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id));

create trigger journaliser after insert or update or delete on public.periodes_paie
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.bulletins
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Espace de stockage privé des bulletins (PDF uniquement, 2 Mo)
-- Chemin : <entreprise_id>/<periode_id>/<salarie_id>-<identifiant>.pdf
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bulletins', 'bulletins', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;

create function prive.periode_du_fichier(p_chemin text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_chemin, '/', 2)::uuid;
exception when others then
  return null;
end
$$;
revoke all on function prive.periode_du_fichier(text) from public;
grant execute on function prive.periode_du_fichier(text) to authenticated;

create policy bulletins_fichiers_lecture on storage.objects for select to authenticated
using (bucket_id = 'bulletins' and prive.a_acces_entreprise(prive.entreprise_du_fichier(name)));
create policy bulletins_fichiers_depot on storage.objects for insert to authenticated
with check (
  bucket_id = 'bulletins'
  and prive.peut_deposer_bulletins(prive.entreprise_du_fichier(name))
  and prive.periode_en_brouillon(prive.periode_du_fichier(name))
);
create policy bulletins_fichiers_retrait on storage.objects for delete to authenticated
using (
  bucket_id = 'bulletins'
  and prive.peut_deposer_bulletins(prive.entreprise_du_fichier(name))
  and prive.periode_en_brouillon(prive.periode_du_fichier(name))
);
