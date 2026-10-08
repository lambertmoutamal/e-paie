-- =====================================================================
-- Étape 5 : salariés et imports Excel
-- =====================================================================
-- Lecture : toute personne ayant accès à l'entreprise (selon l'abonnement).
-- Écriture : administrateurs, gestionnaire de paie et RH (pas le contrôleur
-- ni le signataire), et seulement si l'abonnement permet l'écriture.
-- Un salarié n'est jamais supprimé : il est marqué « sorti » (historique conservé).

create type public.statut_salarie as enum ('actif', 'sorti');
create type public.sexe as enum ('F', 'M');

create table public.salaries (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  profil_id uuid references public.profils (id) on delete set null,  -- compte du portail salarié (étape 9)
  matricule text not null check (length(trim(matricule)) > 0),
  nom text not null check (length(trim(nom)) > 0),
  prenoms text not null check (length(trim(prenoms)) > 0),
  sexe public.sexe,
  date_naissance date,
  nationalite text,
  poste text,
  date_embauche date not null,
  telephone text,
  email text,
  adresse text,
  numero_cnss text,
  banque text,
  numero_compte text,
  statut public.statut_salarie not null default 'actif',
  date_sortie date,
  motif_sortie text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (entreprise_id, matricule),
  check (statut = 'actif' or date_sortie is not null),
  check (date_sortie is null or date_sortie >= date_embauche)
);
create unique index salaries_telephone_unique on public.salaries (entreprise_id, telephone) where telephone is not null;
create index salaries_entreprise_idx on public.salaries (entreprise_id, statut, nom);

create table public.imports_salaries (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  nom_fichier text not null,
  nb_lignes integer not null,
  nb_crees integer not null,
  nb_mis_a_jour integer not null,
  auteur_id uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now()
);

-- Date de dernière modification tenue à jour automatiquement
create function prive.toucher_modifie_le()
returns trigger language plpgsql set search_path = ''
as $$ begin new.modifie_le := now(); return new; end $$;
revoke all on function prive.toucher_modifie_le() from public;

create trigger salaries_modifie_le before update on public.salaries
  for each row execute function prive.toucher_modifie_le();

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------
create function prive.peut_ecrire_salaries(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.gere_entreprise(p_entreprise_id)
    or (
      prive.a_role_entreprise(p_entreprise_id, array['gestionnaire_paie', 'rh']::public.role_entreprise[])
      and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    )
$$;
revoke all on function prive.peut_ecrire_salaries(uuid) from public;
grant execute on function prive.peut_ecrire_salaries(uuid) to authenticated;

-- Pour l'interface : afficher ou non les boutons de modification
create function public.peut_gerer_salaries(p_entreprise_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.peut_ecrire_salaries(p_entreprise_id) $$;
revoke all on function public.peut_gerer_salaries(uuid) from public, anon;
grant execute on function public.peut_gerer_salaries(uuid) to authenticated;

revoke all on public.salaries, public.imports_salaries from anon, authenticated;
grant select, insert, update on public.salaries to authenticated;
grant select, insert on public.imports_salaries to authenticated;

alter table public.salaries enable row level security;
alter table public.imports_salaries enable row level security;

create policy salaries_lecture on public.salaries for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));

create policy salaries_creation on public.salaries for insert to authenticated
with check (prive.peut_ecrire_salaries(entreprise_id));

-- Un salarié ne change jamais d'entreprise (la règle porte sur l'ancienne ET la nouvelle ligne).
create policy salaries_modification on public.salaries for update to authenticated
using (prive.peut_ecrire_salaries(entreprise_id))
with check (prive.peut_ecrire_salaries(entreprise_id));

create function prive.interdire_changement_entreprise()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.entreprise_id <> old.entreprise_id then
    raise exception 'Un salarié ne peut pas changer d''entreprise.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
revoke all on function prive.interdire_changement_entreprise() from public;
create trigger salaries_entreprise_fixe before update on public.salaries
  for each row execute function prive.interdire_changement_entreprise();

create policy imports_salaries_lecture on public.imports_salaries for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy imports_salaries_creation on public.imports_salaries for insert to authenticated
with check (prive.peut_ecrire_salaries(entreprise_id) and auteur_id = (select auth.uid()));

-- Journal d'audit
create trigger journaliser after insert or update or delete on public.salaries
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.imports_salaries
  for each row execute function prive.journaliser('entreprise_id', '');
