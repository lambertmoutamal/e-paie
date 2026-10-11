-- =====================================================================
-- Étape 6 : contrats, avenants, documents du salarié, échéances
-- =====================================================================
-- Mêmes droits que les salariés : lecture pour toute personne ayant accès à
-- l'entreprise, écriture pour admins, gestionnaire de paie et RH, selon l'abonnement.

create type public.type_contrat as enum ('cdi', 'cdd', 'stage', 'apprentissage', 'temporaire');
create type public.nature_contrat as enum ('contrat', 'avenant', 'renouvellement');
create type public.statut_contrat as enum ('brouillon', 'en_cours', 'termine', 'rompu');
create type public.categorie_document as enum ('identite', 'diplome', 'attestation', 'contrat_signe', 'autre');

create table public.contrats (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete cascade,
  contrat_parent_id uuid references public.contrats (id) on delete restrict,
  nature public.nature_contrat not null default 'contrat',
  type_contrat public.type_contrat not null,
  poste text,
  categorie text,
  salaire_base numeric(14, 0) check (salaire_base is null or salaire_base >= 0),
  devise text not null default 'XAF',
  heures_hebdo numeric(5, 2) check (heures_hebdo is null or (heures_hebdo > 0 and heures_hebdo <= 80)),
  lieu_travail text,
  date_debut date not null,
  date_fin_prevue date,
  fin_periode_essai date,
  objet text,                         -- pour un avenant : ce qui change
  statut public.statut_contrat not null default 'en_cours',
  date_fin_effective date,
  motif_fin text,
  fichier_chemin text,                -- PDF signé (espace de stockage privé)
  fichier_nom text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (date_fin_prevue is null or date_fin_prevue >= date_debut),
  check (fin_periode_essai is null or fin_periode_essai >= date_debut),
  -- Un contrat à durée déterminée doit avoir une date de fin
  check (nature = 'avenant' or type_contrat = 'cdi' or date_fin_prevue is not null),
  check (nature = 'contrat' or contrat_parent_id is not null),
  check (statut not in ('termine', 'rompu') or date_fin_effective is not null)
);
-- Un seul contrat principal en cours par salarié (les avenants n'en sont pas)
create unique index contrats_un_seul_en_cours on public.contrats (salarie_id)
  where statut = 'en_cours' and nature <> 'avenant';
create index contrats_entreprise_idx on public.contrats (entreprise_id, statut);
create index contrats_salarie_idx on public.contrats (salarie_id, date_debut desc);

create table public.documents_salarie (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete cascade,
  categorie public.categorie_document not null,
  libelle text not null check (length(trim(libelle)) > 0),
  fichier_chemin text not null unique,
  fichier_nom text not null,
  taille integer not null check (taille > 0),
  type_mime text not null,
  ajoute_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now()
);
create index documents_salarie_idx on public.documents_salarie (salarie_id, cree_le desc);

create trigger contrats_modifie_le before update on public.contrats
  for each row execute function prive.toucher_modifie_le();

-- ---------------------------------------------------------------------
-- Cohérence : le contrat ou le document appartient à l'entreprise du salarié,
-- et un avenant ou renouvellement concerne le même salarié que son parent.
-- ---------------------------------------------------------------------
create function prive.verifier_rattachement_salarie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.salaries s where s.id = new.salarie_id and s.entreprise_id = new.entreprise_id) then
    raise exception 'Le salarié n''appartient pas à cette entreprise.' using errcode = 'insufficient_privilege';
  end if;
  if tg_table_name = 'contrats' and new.contrat_parent_id is not null and not exists (
    select 1 from public.contrats c where c.id = new.contrat_parent_id and c.salarie_id = new.salarie_id
  ) then
    raise exception 'Le contrat d''origine ne concerne pas ce salarié.' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and (new.entreprise_id <> old.entreprise_id or new.salarie_id <> old.salarie_id) then
    raise exception 'Le rattachement ne peut pas être modifié.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
revoke all on function prive.verifier_rattachement_salarie() from public;

create trigger contrats_rattachement before insert or update on public.contrats
  for each row execute function prive.verifier_rattachement_salarie();
create trigger documents_rattachement before insert or update on public.documents_salarie
  for each row execute function prive.verifier_rattachement_salarie();

-- Le poste du contrat principal en cours (ou du dernier avenant) devient le poste du salarié.
create function prive.reporter_poste_salarie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.statut = 'en_cours' and new.poste is not null then
    update public.salaries set poste = new.poste where id = new.salarie_id and poste is distinct from new.poste;
  end if;
  return new;
end
$$;
revoke all on function prive.reporter_poste_salarie() from public;
create trigger contrats_poste_salarie after insert or update of poste, statut on public.contrats
  for each row execute function prive.reporter_poste_salarie();

-- ---------------------------------------------------------------------
-- Droits (mêmes règles que les salariés)
-- ---------------------------------------------------------------------
revoke all on public.contrats, public.documents_salarie from anon, authenticated;
grant select, insert, update on public.contrats to authenticated;
grant select, insert, delete on public.documents_salarie to authenticated;

alter table public.contrats enable row level security;
alter table public.documents_salarie enable row level security;

create policy contrats_lecture on public.contrats for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy contrats_creation on public.contrats for insert to authenticated
with check (prive.peut_ecrire_salaries(entreprise_id));
create policy contrats_modification on public.contrats for update to authenticated
using (prive.peut_ecrire_salaries(entreprise_id)) with check (prive.peut_ecrire_salaries(entreprise_id));

create policy documents_lecture on public.documents_salarie for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy documents_ajout on public.documents_salarie for insert to authenticated
with check (prive.peut_ecrire_salaries(entreprise_id) and ajoute_par = (select auth.uid()));
create policy documents_suppression on public.documents_salarie for delete to authenticated
using (prive.peut_ecrire_salaries(entreprise_id));

create trigger journaliser after insert or update or delete on public.contrats
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.documents_salarie
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Espace de stockage privé des fichiers (contrats signés, documents)
-- Chemin des fichiers : <entreprise_id>/<salarie_id>/<identifiant>-<nom>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Entreprise propriétaire d'un fichier, d'après son chemin (null si chemin invalide)
create function prive.entreprise_du_fichier(p_chemin text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_chemin, '/', 1)::uuid;
exception when others then
  return null;
end
$$;
revoke all on function prive.entreprise_du_fichier(text) from public;
grant execute on function prive.entreprise_du_fichier(text) to authenticated;

create policy documents_fichiers_lecture on storage.objects for select to authenticated
using (bucket_id = 'documents' and prive.a_acces_entreprise(prive.entreprise_du_fichier(name)));
create policy documents_fichiers_ajout on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and prive.peut_ecrire_salaries(prive.entreprise_du_fichier(name)));
create policy documents_fichiers_suppression on storage.objects for delete to authenticated
using (bucket_id = 'documents' and prive.peut_ecrire_salaries(prive.entreprise_du_fichier(name)));

-- ---------------------------------------------------------------------
-- Échéances : fins de CDD et de périodes d'essai dans les N prochains jours
-- (ou déjà dépassées alors que le contrat est toujours en cours)
-- ---------------------------------------------------------------------
create function public.echeances_contrats(p_jours integer default 30)
returns table (
  contrat_id uuid,
  entreprise_id uuid,
  raison_sociale text,
  salarie_id uuid,
  salarie text,
  type_contrat public.type_contrat,
  nature text,          -- 'fin_contrat' ou 'fin_essai'
  echeance date,
  jours_restants integer
)
language sql stable security invoker set search_path = ''
as $$
  select c.id, c.entreprise_id, e.raison_sociale, s.id, s.nom || ' ' || s.prenoms, c.type_contrat,
         x.nature, x.echeance, (x.echeance - current_date)::integer
  from public.contrats c
  join public.salaries s on s.id = c.salarie_id
  join public.entreprises e on e.id = c.entreprise_id
  cross join lateral (
    values ('fin_contrat', c.date_fin_prevue), ('fin_essai', c.fin_periode_essai)
  ) as x(nature, echeance)
  where c.statut = 'en_cours'
    and c.nature <> 'avenant'
    and s.statut = 'actif'
    and x.echeance is not null
    and x.echeance <= current_date + p_jours
    and (x.nature = 'fin_contrat' or x.echeance >= current_date)
  order by x.echeance
$$;
revoke all on function public.echeances_contrats(integer) from public, anon;
grant execute on function public.echeances_contrats(integer) to authenticated;
