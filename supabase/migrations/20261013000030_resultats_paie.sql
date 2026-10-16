-- =====================================================================
-- Résultats de paie importés (Excel du logiciel de paie), par salarié et par mois
-- =====================================================================
-- Ils alimentent le livre de paie, les soldes de tout compte, la DTS et la DAS.
-- Mêmes droits que les bulletins : lecture par les personnes ayant accès à
-- l'entreprise ; import réservé aux administrateurs et au gestionnaire de paie,
-- tant que la période est en brouillon. Les salariés n'y ont pas accès.

create table public.resultats_paie (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  periode_id uuid not null references public.periodes_paie (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete restrict,
  jours_travailles numeric(5, 1),
  salaire_base numeric(16, 2),
  heures_sup numeric(16, 2),
  primes numeric(16, 2),
  avantages_nature numeric(16, 2),
  brut numeric(16, 2),
  brut_imposable numeric(16, 2),
  cnss_salarie numeric(16, 2),
  cnamgs_salarie numeric(16, 2),
  impot_revenu numeric(16, 2),          -- IRPP / ITS retenu
  autres_retenues numeric(16, 2),
  net_a_payer numeric(16, 2),
  cnss_employeur numeric(16, 2),
  cnamgs_employeur numeric(16, 2),
  autres_charges_employeur numeric(16, 2),
  rubriques jsonb not null default '{}'::jsonb,   -- autres colonnes du fichier : { "libellé": montant }
  importe_par uuid references public.profils (id) on delete set null,
  importe_le timestamptz not null default now(),
  unique (periode_id, salarie_id),
  check (jsonb_typeof(rubriques) = 'object')
);
create index resultats_paie_entreprise_idx on public.resultats_paie (entreprise_id, periode_id);
create index resultats_paie_salarie_idx on public.resultats_paie (salarie_id);

-- Cohérence : période et salarié de la même entreprise ; rattachement immuable
create function prive.verifier_resultat_paie()
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
    raise exception 'Le rattachement d''un résultat de paie ne peut pas être modifié.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
revoke all on function prive.verifier_resultat_paie() from public;
create trigger resultats_paie_coherence before insert or update on public.resultats_paie
  for each row execute function prive.verifier_resultat_paie();

alter table public.resultats_paie enable row level security;
revoke all on public.resultats_paie from anon, authenticated;
grant select, insert, update, delete on public.resultats_paie to authenticated;

create policy resultats_paie_lecture on public.resultats_paie for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy resultats_paie_import on public.resultats_paie for insert to authenticated
with check (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id) and importe_par = (select auth.uid()));
create policy resultats_paie_remplacement on public.resultats_paie for update to authenticated
using (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id))
with check (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id) and importe_par = (select auth.uid()));
create policy resultats_paie_retrait on public.resultats_paie for delete to authenticated
using (prive.peut_deposer_bulletins(entreprise_id) and prive.periode_en_brouillon(periode_id));

create trigger journaliser after insert or update or delete on public.resultats_paie
  for each row execute function prive.journaliser('entreprise_id', '');
