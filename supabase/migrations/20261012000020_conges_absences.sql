-- =====================================================================
-- Étape 10 : congés, permissions et absences
-- =====================================================================
-- Le salarié demande depuis son portail ; le RH (ou, à défaut de RH, un
-- administrateur) accepte ou refuse. Le RH peut aussi saisir une absence.
-- Solde de congés calculé automatiquement : solde de départ + jours acquis
-- chaque mois − congés pris. Toutes les écritures passent par des fonctions.

-- ---------------------------------------------------------------------
-- Réglages par entreprise
-- ---------------------------------------------------------------------
create table public.parametres_conges (
  entreprise_id uuid primary key references public.entreprises (id) on delete cascade,
  jours_par_mois numeric(4, 2) not null default 2 check (jours_par_mois between 0 and 5),
  -- « ouvrables » : du lundi au samedi ; « ouvres » : du lundi au vendredi
  decompte text not null default 'ouvrables' check (decompte in ('ouvrables', 'ouvres')),
  modifie_le timestamptz not null default now()
);

create table public.jours_feries (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  jour date not null,
  libelle text not null check (char_length(btrim(libelle)) between 2 and 80),
  unique (entreprise_id, jour)
);

create table public.types_absence (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  libelle text not null check (char_length(btrim(libelle)) between 2 and 80),
  nature text not null check (nature in ('conge', 'permission', 'maladie', 'autre')),
  deduit_solde boolean not null default false,       -- décompté du solde de congés
  jours_max numeric(5, 1) check (jours_max is null or jours_max > 0),
  justificatif_requis boolean not null default false,
  demandable boolean not null default true,          -- le salarié peut le demander lui-même
  actif boolean not null default true,
  ordre integer not null default 100,
  unique (entreprise_id, libelle)
);

-- Solde de départ saisi par le RH (sinon : 0 jour à la date d'embauche)
create table public.soldes_conges_initiaux (
  salarie_id uuid primary key references public.salaries (id) on delete cascade,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  date_reference date not null,
  jours numeric(6, 2) not null check (jours between -100 and 1000),
  saisi_par uuid references public.profils (id) on delete set null,
  modifie_le timestamptz not null default now()
);

create type public.statut_demande as enum ('en_attente', 'acceptee', 'refusee', 'annulee');

create table public.demandes_absence (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete cascade,
  type_id uuid not null references public.types_absence (id) on delete restrict,
  debut date not null,
  fin date not null,
  debut_apres_midi boolean not null default false,   -- le premier jour commence à midi
  fin_midi boolean not null default false,           -- le dernier jour s'arrête à midi
  nb_jours numeric(5, 1) not null check (nb_jours > 0),
  motif text check (motif is null or char_length(motif) <= 500),
  justificatif_chemin text,
  statut public.statut_demande not null default 'en_attente',
  saisie_rh boolean not null default false,
  commentaire_decision text check (commentaire_decision is null or char_length(commentaire_decision) <= 500),
  decide_par uuid references public.profils (id) on delete set null,
  decide_le timestamptz,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default clock_timestamp(),
  check (fin >= debut),
  check (fin - debut <= 366)
);
create index demandes_absence_salarie_idx on public.demandes_absence (salarie_id, debut desc);
create index demandes_absence_attente_idx on public.demandes_absence (entreprise_id) where statut = 'en_attente';

-- ---------------------------------------------------------------------
-- Types par défaut (valeurs indicatives, modifiables par chaque entreprise)
-- ---------------------------------------------------------------------
create function prive.creer_types_absence_defaut(p_entreprise_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.types_absence (entreprise_id, libelle, nature, deduit_solde, jours_max, justificatif_requis, demandable, ordre)
  values
    (p_entreprise_id, 'Congé payé', 'conge', true, null, false, true, 1),
    (p_entreprise_id, 'Permission : mariage du salarié', 'permission', false, 3, true, true, 10),
    (p_entreprise_id, 'Permission : naissance d''un enfant', 'permission', false, 3, true, true, 11),
    (p_entreprise_id, 'Permission : décès d''un proche', 'permission', false, 3, true, true, 12),
    (p_entreprise_id, 'Permission : mariage d''un enfant', 'permission', false, 1, true, true, 13),
    (p_entreprise_id, 'Permission : déménagement', 'permission', false, 1, false, true, 14),
    (p_entreprise_id, 'Permission exceptionnelle (sans solde)', 'permission', false, null, false, true, 15),
    (p_entreprise_id, 'Maladie', 'maladie', false, null, true, true, 20),
    (p_entreprise_id, 'Absence injustifiée', 'autre', false, null, false, false, 30)
  on conflict (entreprise_id, libelle) do nothing;
  insert into public.parametres_conges (entreprise_id) values (p_entreprise_id) on conflict do nothing;
$$;
revoke all on function prive.creer_types_absence_defaut(uuid) from public;

create function prive.apres_creation_entreprise_conges()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform prive.creer_types_absence_defaut(new.id);
  return null;
end
$$;
create trigger types_absence_defaut after insert on public.entreprises
  for each row execute function prive.apres_creation_entreprise_conges();

select prive.creer_types_absence_defaut(id) from public.entreprises;

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------
-- Gérer les absences : administrateurs ou RH (abonnement actif)
create function prive.peut_gerer_absences(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.gere_entreprise(p_entreprise_id)
    or (
      prive.a_role_entreprise(p_entreprise_id, array['rh']::public.role_entreprise[])
      and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    )
$$;

-- Qui doit traiter les demandes : le RH s'il y en a un, sinon les administrateurs
create function prive.doit_traiter_absences(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    and (
      prive.a_role_entreprise(p_entreprise_id, array['rh']::public.role_entreprise[])
      or (
        not exists (select 1 from public.affectations a where a.entreprise_id = p_entreprise_id and a.actif and a.role = 'rh')
        and prive.administre_entreprise(p_entreprise_id)
        and not prive.est_admin_plateforme()
      )
    )
$$;

revoke all on function prive.peut_gerer_absences(uuid), prive.doit_traiter_absences(uuid) from public;
grant execute on function prive.peut_gerer_absences(uuid), prive.doit_traiter_absences(uuid) to authenticated;

create function public.peut_gerer_absences(p_entreprise_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.peut_gerer_absences(p_entreprise_id) $$;
revoke all on function public.peut_gerer_absences(uuid) from public, anon;
grant execute on function public.peut_gerer_absences(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Calculs
-- ---------------------------------------------------------------------
-- Nombre de jours décomptés entre deux dates (jours non travaillés et fériés exclus)
create function prive.jours_decomptes(
  p_entreprise_id uuid, p_debut date, p_fin date, p_debut_apres_midi boolean, p_fin_midi boolean
)
returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_decompte text := coalesce((select c.decompte from public.parametres_conges c where c.entreprise_id = p_entreprise_id), 'ouvrables');
  v_jour date;
  v_total numeric := 0;
  v_travaille boolean;
begin
  if p_fin < p_debut then return 0; end if;
  v_jour := p_debut;
  while v_jour <= p_fin loop
    v_travaille := extract(isodow from v_jour) < case when v_decompte = 'ouvres' then 6 else 7 end
      and not exists (select 1 from public.jours_feries f where f.entreprise_id = p_entreprise_id and f.jour = v_jour);
    if v_travaille then
      v_total := v_total + 1;
      if v_jour = p_debut and p_debut_apres_midi then v_total := v_total - 0.5; end if;
      if v_jour = p_fin and p_fin_midi then v_total := v_total - 0.5; end if;
    end if;
    v_jour := v_jour + 1;
  end loop;
  return greatest(v_total, 0);
end
$$;
revoke all on function prive.jours_decomptes(uuid, date, date, boolean, boolean) from public;

create function public.jours_decomptes(
  p_entreprise_id uuid, p_debut date, p_fin date, p_debut_apres_midi boolean, p_fin_midi boolean
)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case
    when prive.a_acces_entreprise(p_entreprise_id)
      or exists (select 1 from public.salaries s where s.entreprise_id = p_entreprise_id and prive.est_mon_salarie(s.id))
    then prive.jours_decomptes(p_entreprise_id, p_debut, p_fin, p_debut_apres_midi, p_fin_midi)
  end
$$;
revoke all on function public.jours_decomptes(uuid, date, date, boolean, boolean) from public, anon;
grant execute on function public.jours_decomptes(uuid, date, date, boolean, boolean) to authenticated;

-- Solde de congés d'un salarié (sans contrôle d'accès : appelé par les fonctions publiques)
create function prive.solde_conges(p_salarie_id uuid)
returns table (date_reference date, solde_initial numeric, acquis numeric, pris numeric, en_attente numeric, disponible numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  s public.salaries;
  v_ref date;
  v_initial numeric;
  v_par_mois numeric;
  v_fin date;
  v_mois integer;
  v_acquis numeric;
  v_pris numeric;
  v_attente numeric;
begin
  select * into s from public.salaries where id = p_salarie_id;
  if not found then return; end if;
  select i.date_reference, i.jours into v_ref, v_initial from public.soldes_conges_initiaux i where i.salarie_id = s.id;
  v_ref := coalesce(v_ref, s.date_embauche);
  v_initial := coalesce(v_initial, 0);
  v_par_mois := coalesce((select c.jours_par_mois from public.parametres_conges c where c.entreprise_id = s.entreprise_id), 2);
  v_fin := least(current_date, coalesce(s.date_sortie, current_date));
  -- Mois complets écoulés depuis la date de référence
  v_mois := greatest(
    0,
    (extract(year from v_fin) * 12 + extract(month from v_fin)) - (extract(year from v_ref) * 12 + extract(month from v_ref))
      - case when extract(day from v_fin) < extract(day from v_ref) then 1 else 0 end
  );
  v_acquis := v_mois * v_par_mois;
  select coalesce(sum(d.nb_jours) filter (where d.statut = 'acceptee'), 0),
         coalesce(sum(d.nb_jours) filter (where d.statut = 'en_attente'), 0)
    into v_pris, v_attente
    from public.demandes_absence d join public.types_absence t on t.id = d.type_id
   where d.salarie_id = s.id and t.deduit_solde and d.debut >= v_ref;
  return query select v_ref, v_initial, v_acquis, v_pris, v_attente, v_initial + v_acquis - v_pris;
end
$$;
revoke all on function prive.solde_conges(uuid) from public;

-- ---------------------------------------------------------------------
-- Cohérence des demandes (aussi pour les écritures du serveur)
-- ---------------------------------------------------------------------
create function prive.verifier_demande_absence()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t public.types_absence;
begin
  if not exists (select 1 from public.salaries s where s.id = new.salarie_id and s.entreprise_id = new.entreprise_id) then
    raise exception 'Le salarié n''appartient pas à cette entreprise.';
  end if;
  select * into t from public.types_absence where id = new.type_id and entreprise_id = new.entreprise_id;
  if not found then raise exception 'Type d''absence inconnu pour cette entreprise.'; end if;
  if tg_op = 'UPDATE' and (new.salarie_id <> old.salarie_id or new.entreprise_id <> old.entreprise_id) then
    raise exception 'Le rattachement d''une demande ne peut pas être modifié.';
  end if;

  new.nb_jours := prive.jours_decomptes(new.entreprise_id, new.debut, new.fin, new.debut_apres_midi, new.fin_midi);
  if new.nb_jours <= 0 then
    raise exception 'Ces dates ne comprennent aucun jour de travail (week-end ou jour férié).';
  end if;
  if new.statut in ('en_attente', 'acceptee') and exists (
    select 1 from public.demandes_absence d
     where d.salarie_id = new.salarie_id and d.id <> new.id and d.statut in ('en_attente', 'acceptee')
       and daterange(d.debut, d.fin, '[]') && daterange(new.debut, new.fin, '[]')
  ) then
    raise exception 'Une autre absence existe déjà sur ces dates.';
  end if;
  return new;
end
$$;
revoke all on function prive.verifier_demande_absence() from public;
create trigger demandes_absence_coherence before insert or update on public.demandes_absence
  for each row execute function prive.verifier_demande_absence();

-- ---------------------------------------------------------------------
-- Accès aux tables : lecture par les personnes de l'entreprise ; écriture des
-- réglages par les gestionnaires d'absences ; demandes uniquement par fonctions.
-- ---------------------------------------------------------------------
alter table public.parametres_conges enable row level security;
alter table public.jours_feries enable row level security;
alter table public.types_absence enable row level security;
alter table public.soldes_conges_initiaux enable row level security;
alter table public.demandes_absence enable row level security;

revoke all on public.parametres_conges, public.jours_feries, public.types_absence,
  public.soldes_conges_initiaux, public.demandes_absence from anon, authenticated;
grant select on public.parametres_conges, public.jours_feries, public.types_absence,
  public.soldes_conges_initiaux, public.demandes_absence to authenticated;
grant insert, delete on public.jours_feries to authenticated;
grant insert (entreprise_id, libelle, nature, deduit_solde, jours_max, justificatif_requis, demandable, ordre),
  update (libelle, deduit_solde, jours_max, justificatif_requis, demandable, actif, ordre)
  on public.types_absence to authenticated;
grant update (jours_par_mois, decompte, modifie_le) on public.parametres_conges to authenticated;

create policy parametres_conges_lecture on public.parametres_conges for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy parametres_conges_modification on public.parametres_conges for update to authenticated
using (prive.peut_gerer_absences(entreprise_id)) with check (prive.peut_gerer_absences(entreprise_id));

create policy jours_feries_lecture on public.jours_feries for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy jours_feries_ajout on public.jours_feries for insert to authenticated
with check (prive.peut_gerer_absences(entreprise_id));
create policy jours_feries_retrait on public.jours_feries for delete to authenticated
using (prive.peut_gerer_absences(entreprise_id));

create policy types_absence_lecture on public.types_absence for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));
create policy types_absence_ajout on public.types_absence for insert to authenticated
with check (prive.peut_gerer_absences(entreprise_id));
create policy types_absence_modification on public.types_absence for update to authenticated
using (prive.peut_gerer_absences(entreprise_id)) with check (prive.peut_gerer_absences(entreprise_id));

create policy soldes_initiaux_lecture on public.soldes_conges_initiaux for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));

create policy demandes_absence_lecture on public.demandes_absence for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));

create trigger journaliser after insert or update or delete on public.parametres_conges
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.jours_feries
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.types_absence
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.soldes_conges_initiaux
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.demandes_absence
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Fonctions du personnel (RH, administrateurs)
-- ---------------------------------------------------------------------
create function public.decider_demande(p_demande_id uuid, p_accepter boolean, p_commentaire text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.demandes_absence;
begin
  select * into d from public.demandes_absence where id = p_demande_id for update;
  if not found or not prive.peut_gerer_absences(d.entreprise_id) then
    raise exception 'Vous ne pouvez pas traiter cette demande.';
  end if;
  if d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée.'; end if;
  if not p_accepter and char_length(btrim(coalesce(p_commentaire, ''))) < 5 then
    raise exception 'Expliquez le motif du refus (5 caractères au moins).';
  end if;
  update public.demandes_absence
     set statut = case when p_accepter then 'acceptee'::public.statut_demande else 'refusee'::public.statut_demande end,
         commentaire_decision = nullif(left(btrim(coalesce(p_commentaire, '')), 500), ''),
         decide_par = (select auth.uid()), decide_le = now()
   where id = d.id;
end
$$;

-- Absence saisie directement par le RH (acceptée d'office)
create function public.saisir_absence(
  p_salarie_id uuid, p_type_id uuid, p_debut date, p_fin date,
  p_debut_apres_midi boolean, p_fin_midi boolean, p_motif text, p_justificatif text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_entreprise uuid := (select s.entreprise_id from public.salaries s where s.id = p_salarie_id);
  v_id uuid;
begin
  if v_entreprise is null or not prive.peut_gerer_absences(v_entreprise) then
    raise exception 'Vous ne pouvez pas saisir d''absence pour ce salarié.';
  end if;
  if p_justificatif is not null and prive.entreprise_du_fichier(p_justificatif) is distinct from v_entreprise then
    raise exception 'Justificatif invalide.';
  end if;
  insert into public.demandes_absence (entreprise_id, salarie_id, type_id, debut, fin, debut_apres_midi, fin_midi, nb_jours,
                                       motif, justificatif_chemin, statut, saisie_rh, decide_par, decide_le, cree_par)
  values (v_entreprise, p_salarie_id, p_type_id, p_debut, p_fin, p_debut_apres_midi, p_fin_midi, 1,
          nullif(left(btrim(coalesce(p_motif, '')), 500), ''), p_justificatif, 'acceptee', true,
          (select auth.uid()), now(), (select auth.uid()))
  returning id into v_id;
  return v_id;
end
$$;

-- Annulation par le RH d'une absence acceptée (ex. congé finalement non pris)
create function public.annuler_absence(p_demande_id uuid, p_commentaire text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.demandes_absence;
begin
  select * into d from public.demandes_absence where id = p_demande_id for update;
  if not found or not prive.peut_gerer_absences(d.entreprise_id) then
    raise exception 'Vous ne pouvez pas annuler cette absence.';
  end if;
  if d.statut not in ('acceptee', 'en_attente') then raise exception 'Cette absence est déjà close.'; end if;
  if char_length(btrim(coalesce(p_commentaire, ''))) < 5 then
    raise exception 'Expliquez le motif de l''annulation (5 caractères au moins).';
  end if;
  update public.demandes_absence
     set statut = 'annulee', commentaire_decision = left(btrim(p_commentaire), 500), decide_par = (select auth.uid()), decide_le = now()
   where id = d.id;
end
$$;

create function public.definir_solde_initial(p_salarie_id uuid, p_date_reference date, p_jours numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_entreprise uuid := (select s.entreprise_id from public.salaries s where s.id = p_salarie_id);
begin
  if v_entreprise is null or not prive.peut_gerer_absences(v_entreprise) then
    raise exception 'Vous ne pouvez pas modifier ce solde.';
  end if;
  insert into public.soldes_conges_initiaux (salarie_id, entreprise_id, date_reference, jours, saisi_par)
  values (p_salarie_id, v_entreprise, p_date_reference, p_jours, (select auth.uid()))
  on conflict (salarie_id) do update
    set date_reference = excluded.date_reference, jours = excluded.jours, saisi_par = excluded.saisi_par, modifie_le = now();
end
$$;

-- Soldes de tous les salariés d'une entreprise (tableau RH)
create function public.soldes_entreprise(p_entreprise_id uuid)
returns table (salarie_id uuid, date_reference date, solde_initial numeric, acquis numeric, pris numeric, en_attente numeric, disponible numeric)
language sql stable security definer set search_path = ''
as $$
  select s.id, c.*
  from public.salaries s, lateral prive.solde_conges(s.id) c
  where s.entreprise_id = p_entreprise_id and prive.a_acces_entreprise(p_entreprise_id)
$$;

-- Demandes en attente que la personne connectée doit traiter (carte « À faire »)
create function public.mes_demandes_a_traiter()
returns table (demande_id uuid, entreprise_id uuid, raison_sociale text, salarie text, type_libelle text,
               debut date, fin date, nb_jours numeric, cree_le timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.entreprise_id, e.raison_sociale, s.nom || ' ' || s.prenoms, t.libelle, d.debut, d.fin, d.nb_jours, d.cree_le
  from public.demandes_absence d
  join public.entreprises e on e.id = d.entreprise_id
  join public.salaries s on s.id = d.salarie_id
  join public.types_absence t on t.id = d.type_id
  where d.statut = 'en_attente' and prive.doit_traiter_absences(d.entreprise_id)
  order by d.cree_le
$$;

-- ---------------------------------------------------------------------
-- Fonctions du salarié (portail) : uniquement pour ses propres fiches
-- ---------------------------------------------------------------------
create function public.mes_types_absence(p_salarie_id uuid)
returns table (id uuid, libelle text, nature text, deduit_solde boolean, jours_max numeric, justificatif_requis boolean)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.libelle, t.nature, t.deduit_solde, t.jours_max, t.justificatif_requis
  from public.types_absence t join public.salaries s on s.entreprise_id = t.entreprise_id
  where s.id = p_salarie_id and prive.est_mon_salarie(s.id) and t.actif and t.demandable
  order by t.ordre, t.libelle
$$;

create function public.mon_solde_conges(p_salarie_id uuid)
returns table (date_reference date, solde_initial numeric, acquis numeric, pris numeric, en_attente numeric, disponible numeric)
language sql stable security definer set search_path = ''
as $$ select c.* from prive.solde_conges(p_salarie_id) c where prive.est_mon_salarie(p_salarie_id) $$;

create function public.mes_demandes_absence()
returns table (id uuid, salarie_id uuid, raison_sociale text, type_libelle text, debut date, fin date,
               debut_apres_midi boolean, fin_midi boolean, nb_jours numeric, statut text, motif text,
               commentaire_decision text, cree_le timestamptz, saisie_rh boolean)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.salarie_id, e.raison_sociale, t.libelle, d.debut, d.fin, d.debut_apres_midi, d.fin_midi, d.nb_jours,
         d.statut::text, d.motif, d.commentaire_decision, d.cree_le, d.saisie_rh
  from public.demandes_absence d
  join public.types_absence t on t.id = d.type_id
  join public.entreprises e on e.id = d.entreprise_id
  where prive.est_mon_salarie(d.salarie_id)
  order by d.debut desc
$$;

create function public.demander_absence(
  p_salarie_id uuid, p_type_id uuid, p_debut date, p_fin date,
  p_debut_apres_midi boolean, p_fin_midi boolean, p_motif text, p_justificatif text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.salaries;
  t public.types_absence;
  v_jours numeric;
  v_id uuid;
begin
  select * into s from public.salaries where id = p_salarie_id;
  if not found or not prive.est_mon_salarie(s.id) then raise exception 'Demande impossible.'; end if;
  if not prive.ecriture_permise(prive.phase_entreprise(s.entreprise_id)) then
    raise exception 'Les demandes sont suspendues pour le moment. Contactez votre service RH.';
  end if;
  select * into t from public.types_absence where id = p_type_id and entreprise_id = s.entreprise_id and actif and demandable;
  if not found then raise exception 'Ce type d''absence n''est pas disponible.'; end if;
  if p_debut < current_date - 30 then raise exception 'La date de début est trop ancienne.'; end if;
  v_jours := prive.jours_decomptes(s.entreprise_id, p_debut, p_fin, p_debut_apres_midi, p_fin_midi);
  if t.jours_max is not null and v_jours > t.jours_max then
    raise exception 'Ce type d''absence est limité à % jour(s).', t.jours_max;
  end if;
  if t.justificatif_requis and p_justificatif is null then
    raise exception 'Un justificatif est obligatoire pour ce type d''absence.';
  end if;
  if p_justificatif is not null and (
    prive.entreprise_du_fichier(p_justificatif) is distinct from s.entreprise_id
    or split_part(p_justificatif, '/', 2) <> s.id::text
  ) then
    raise exception 'Justificatif invalide.';
  end if;
  insert into public.demandes_absence (entreprise_id, salarie_id, type_id, debut, fin, debut_apres_midi, fin_midi, nb_jours,
                                       motif, justificatif_chemin, cree_par)
  values (s.entreprise_id, s.id, t.id, p_debut, p_fin, p_debut_apres_midi, p_fin_midi, 1,
          nullif(left(btrim(coalesce(p_motif, '')), 500), ''), p_justificatif, (select auth.uid()))
  returning id into v_id;
  return v_id;
end
$$;

create function public.annuler_ma_demande(p_demande_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.demandes_absence set statut = 'annulee', decide_le = now()
   where id = p_demande_id and statut = 'en_attente' and prive.est_mon_salarie(salarie_id);
  if not found then raise exception 'Seule une demande en attente peut être annulée.'; end if;
end
$$;

-- ---------------------------------------------------------------------
-- Alertes (serveur uniquement)
-- ---------------------------------------------------------------------
-- Personnes qui doivent traiter une nouvelle demande : RH, sinon administrateurs
create function public.destinataires_demande_absence(p_demande_id uuid)
returns table (profil_id uuid, email text, whatsapp text, nom_complet text, entreprise_id uuid, raison_sociale text,
               salarie text, type_libelle text, debut date, fin date, nb_jours numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  d public.demandes_absence;
begin
  select * into d from public.demandes_absence where id = p_demande_id;
  if not found or d.statut <> 'en_attente' then return; end if;
  return query
    with rh as (
      select a.profil_id from public.affectations a where a.entreprise_id = d.entreprise_id and a.actif and a.role = 'rh'
    ),
    candidats as (
      select profil_id from rh
      union
      select c.profil_id from prive.administrateurs_entreprise(d.entreprise_id) c(profil_id) where not exists (select 1 from rh)
    )
    select pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.id, e.raison_sociale, s.nom || ' ' || s.prenoms, t.libelle,
           d.debut, d.fin, d.nb_jours
    from candidats c
    join public.profils pr on pr.id = c.profil_id
    join public.entreprises e on e.id = d.entreprise_id
    join public.salaries s on s.id = d.salarie_id
    join public.types_absence t on t.id = d.type_id
    where pr.email is not null;
end
$$;

-- Coordonnées du salarié pour l'informer de la décision
create function public.infos_decision_absence(p_demande_id uuid)
returns table (prenoms text, telephone text, email text, raison_sociale text, type_libelle text,
               debut date, fin date, nb_jours numeric, statut text, commentaire text)
language sql stable security definer set search_path = ''
as $$
  select s.prenoms, s.telephone, s.email, e.raison_sociale, t.libelle, d.debut, d.fin, d.nb_jours, d.statut::text, d.commentaire_decision
  from public.demandes_absence d
  join public.salaries s on s.id = d.salarie_id
  join public.entreprises e on e.id = d.entreprise_id
  join public.types_absence t on t.id = d.type_id
  where d.id = p_demande_id
$$;

revoke all on function
  public.decider_demande(uuid, boolean, text),
  public.saisir_absence(uuid, uuid, date, date, boolean, boolean, text, text),
  public.annuler_absence(uuid, text),
  public.definir_solde_initial(uuid, date, numeric),
  public.soldes_entreprise(uuid),
  public.mes_demandes_a_traiter(),
  public.mes_types_absence(uuid),
  public.mon_solde_conges(uuid),
  public.mes_demandes_absence(),
  public.demander_absence(uuid, uuid, date, date, boolean, boolean, text, text),
  public.annuler_ma_demande(uuid),
  public.destinataires_demande_absence(uuid),
  public.infos_decision_absence(uuid)
from public, anon;
grant execute on function
  public.decider_demande(uuid, boolean, text),
  public.saisir_absence(uuid, uuid, date, date, boolean, boolean, text, text),
  public.annuler_absence(uuid, text),
  public.definir_solde_initial(uuid, date, numeric),
  public.soldes_entreprise(uuid),
  public.mes_demandes_a_traiter(),
  public.mes_types_absence(uuid),
  public.mon_solde_conges(uuid),
  public.mes_demandes_absence(),
  public.demander_absence(uuid, uuid, date, date, boolean, boolean, text, text),
  public.annuler_ma_demande(uuid)
to authenticated;
grant execute on function public.destinataires_demande_absence(uuid), public.infos_decision_absence(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Justificatifs : espace privé « absences » (PDF, JPEG, PNG ; 5 Mo)
-- Chemin : <entreprise_id>/<salarie_id>/<identifiant>.<extension>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('absences', 'absences', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Le fichier est-il dans le dossier d'un de mes emplois ?
create function prive.fichier_absence_a_moi(p_chemin text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_salarie uuid;
begin
  begin
    v_salarie := split_part(p_chemin, '/', 2)::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.salaries s
    where s.id = v_salarie and s.entreprise_id = prive.entreprise_du_fichier(p_chemin) and prive.est_mon_salarie(s.id)
  );
end
$$;
revoke all on function prive.fichier_absence_a_moi(text) from public;
grant execute on function prive.fichier_absence_a_moi(text) to authenticated;

create policy absences_fichiers_lecture on storage.objects for select to authenticated
using (bucket_id = 'absences' and (prive.a_acces_entreprise(prive.entreprise_du_fichier(name)) or prive.fichier_absence_a_moi(name)));
create policy absences_fichiers_depot on storage.objects for insert to authenticated
with check (bucket_id = 'absences' and (prive.peut_gerer_absences(prive.entreprise_du_fichier(name)) or prive.fichier_absence_a_moi(name)));
create policy absences_fichiers_retrait on storage.objects for delete to authenticated
using (bucket_id = 'absences' and prive.peut_gerer_absences(prive.entreprise_du_fichier(name)));
