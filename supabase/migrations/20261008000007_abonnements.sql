-- =====================================================================
-- Étape 4 bis : inscription libre, formules et abonnements
-- =====================================================================
-- Cycle de vie d'un abonnement (calculé à partir des dates, sans tâche planifiée) :
--   essai / actif  → accès complet jusqu'à la date de fin
--   lecture_seule  → 30 jours après la fin : consultation et export uniquement
--   bloque         → ensuite : plus aucun accès (décision du 2026-10-08, salariés compris)
-- Une structure SANS abonnement (créée par l'administrateur plateforme) est « gérée » :
-- accès complet, sans limite de durée.

create type public.statut_abonnement as enum ('essai', 'actif', 'resilie');
create type public.cible_formule as enum ('cabinet', 'entreprise');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.formules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  libelle text not null check (length(trim(libelle)) > 0),
  cible public.cible_formule,            -- vide = cabinets et entreprises
  est_essai boolean not null default false,
  prix_mensuel numeric(12, 0) not null default 0 check (prix_mensuel >= 0),
  devise text not null default 'XAF',
  duree_jours integer not null default 30 check (duree_jours > 0),
  description text,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

insert into public.formules (code, libelle, cible, est_essai, prix_mensuel, duree_jours, description) values
  ('essai', 'Essai gratuit', null, true, 0, 30, 'Accès complet pendant 30 jours, sans engagement.'),
  ('pro_cabinet', 'Pro Cabinet', 'cabinet', false, 0, 30, 'Pour les cabinets comptables : gestion de plusieurs entreprises clientes.'),
  ('pro_entreprise', 'Pro Entreprise', 'entreprise', false, 0, 30, 'Pour les entreprises qui réalisent leur paie elles-mêmes.');

create table public.abonnements (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid unique references public.cabinets (id) on delete cascade,
  entreprise_id uuid unique references public.entreprises (id) on delete cascade,
  formule_id uuid not null references public.formules (id),
  statut public.statut_abonnement not null,
  debut timestamptz not null default now(),
  fin timestamptz not null,
  demande_pro_le timestamptz,           -- le client a demandé à passer à Pro
  cree_le timestamptz not null default now(),
  check ((cabinet_id is null) <> (entreprise_id is null)),
  check (fin > debut)
);

-- Trace des inscriptions libres (une seule par compte)
create table public.inscriptions (
  profil_id uuid primary key references public.profils (id) on delete cascade,
  type text not null check (type in ('cabinet', 'entreprise')),
  cabinet_id uuid references public.cabinets (id) on delete set null,
  entreprise_id uuid references public.entreprises (id) on delete set null,
  formule_souhaitee text not null,
  cree_le timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Phases
-- ---------------------------------------------------------------------
create function prive.phase_abonnement(p_statut public.statut_abonnement, p_fin timestamptz)
returns text
language sql stable set search_path = ''
as $$
  select case
    when now() <= p_fin then case when p_statut = 'essai' then 'essai' else 'actif' end
    when now() <= p_fin + interval '30 days' then 'lecture_seule'
    else 'bloque'
  end
$$;

create function prive.phase_cabinet(p_cabinet_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select prive.phase_abonnement(a.statut, a.fin) from public.abonnements a where a.cabinet_id = p_cabinet_id),
    'gere'
  )
$$;

-- Une entreprise suit son propre abonnement (entreprise autonome)
-- ou, à défaut, celui de son cabinet.
create function prive.phase_entreprise(p_entreprise_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select prive.phase_abonnement(a.statut, a.fin) from public.abonnements a where a.entreprise_id = p_entreprise_id),
    (select prive.phase_abonnement(a.statut, a.fin)
       from public.abonnements a join public.entreprises e on e.cabinet_id = a.cabinet_id
      where e.id = p_entreprise_id),
    'gere'
  )
$$;

create function prive.ecriture_permise(p_phase text)
returns boolean
language sql immutable set search_path = ''
as $$ select p_phase in ('essai', 'actif', 'gere') $$;

-- Cabinet actuel d'une entreprise (lecture sans RLS, pour les règles d'écriture)
create function prive.cabinet_actuel(p_entreprise_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select e.cabinet_id from public.entreprises e where e.id = p_entreprise_id $$;

-- ---------------------------------------------------------------------
-- Fonctions de droits : on y ajoute les phases d'abonnement
-- ---------------------------------------------------------------------

-- Qui administre l'entreprise (sans tenir compte de l'abonnement)
create function prive.administre_entreprise(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.est_admin_plateforme()
    or exists (
      select 1 from public.entreprises e
      join public.membres_cabinet m on m.cabinet_id = e.cabinet_id
      where e.id = p_entreprise_id and m.profil_id = (select auth.uid())
    )
    or exists (
      select 1 from public.affectations a
      where a.entreprise_id = p_entreprise_id and a.profil_id = (select auth.uid())
        and a.actif and a.role = 'admin_entreprise'
    )
$$;

-- Peut modifier (admin) : uniquement si l'abonnement le permet
create or replace function prive.gere_entreprise(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.est_admin_plateforme()
    or (prive.administre_entreprise(p_entreprise_id)
        and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id)))
$$;

-- Peut consulter : tant que l'abonnement n'est pas bloqué
create or replace function prive.a_acces_entreprise(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.est_admin_plateforme()
    or (
      prive.phase_entreprise(p_entreprise_id) <> 'bloque'
      and (
        prive.administre_entreprise(p_entreprise_id)
        or exists (
          select 1 from public.affectations a
          where a.entreprise_id = p_entreprise_id and a.profil_id = (select auth.uid()) and a.actif
        )
      )
    )
$$;

create function prive.peut_ecrire_cabinet(p_cabinet_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.est_admin_plateforme()
    or (prive.est_admin_cabinet(p_cabinet_id) and prive.ecriture_permise(prive.phase_cabinet(p_cabinet_id)))
$$;

create or replace function public.peut_gerer_cabinet(p_cabinet_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.peut_ecrire_cabinet(p_cabinet_id) $$;

revoke all on function prive.phase_abonnement(public.statut_abonnement, timestamptz) from public;
revoke all on function prive.phase_cabinet(uuid) from public;
revoke all on function prive.phase_entreprise(uuid) from public;
revoke all on function prive.ecriture_permise(text) from public;
revoke all on function prive.cabinet_actuel(uuid) from public;
revoke all on function prive.administre_entreprise(uuid) from public;
revoke all on function prive.peut_ecrire_cabinet(uuid) from public;
grant execute on function
  prive.phase_abonnement(public.statut_abonnement, timestamptz),
  prive.phase_cabinet(uuid),
  prive.phase_entreprise(uuid),
  prive.ecriture_permise(text),
  prive.cabinet_actuel(uuid),
  prive.administre_entreprise(uuid),
  prive.peut_ecrire_cabinet(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- Règles existantes mises à jour pour respecter les phases
-- ---------------------------------------------------------------------
drop policy entreprises_lecture on public.entreprises;
create policy entreprises_lecture on public.entreprises for select to authenticated
using (
  prive.a_acces_entreprise(id)
  or (cabinet_id is not null and prive.est_admin_cabinet(cabinet_id) and prive.phase_cabinet(cabinet_id) <> 'bloque')
);

drop policy entreprises_creation on public.entreprises;
create policy entreprises_creation on public.entreprises for insert to authenticated
with check (
  prive.est_admin_plateforme()
  or (cabinet_id is not null and prive.peut_ecrire_cabinet(cabinet_id))
);

-- Un admin cabinet ne peut ni déplacer ni détacher une entreprise ;
-- un admin entreprise modifie la fiche d'une entreprise autonome, sans la rattacher ailleurs.
drop policy entreprises_modification on public.entreprises;
create policy entreprises_modification on public.entreprises for update to authenticated
using (prive.gere_entreprise(id))
with check (
  prive.est_admin_plateforme()
  or (cabinet_id is not null and prive.peut_ecrire_cabinet(cabinet_id))
  or (
    cabinet_id is null
    and prive.cabinet_actuel(id) is null
    and prive.a_role_entreprise(id, array['admin_entreprise']::public.role_entreprise[])
    and prive.ecriture_permise(prive.phase_entreprise(id))
  )
);

drop policy cabinets_modification on public.cabinets;
create policy cabinets_modification on public.cabinets for update to authenticated
using (prive.peut_ecrire_cabinet(id))
with check (prive.peut_ecrire_cabinet(id));

drop policy membres_cabinet_ajout on public.membres_cabinet;
create policy membres_cabinet_ajout on public.membres_cabinet for insert to authenticated
with check (prive.peut_ecrire_cabinet(cabinet_id));

drop policy membres_cabinet_retrait on public.membres_cabinet;
create policy membres_cabinet_retrait on public.membres_cabinet for delete to authenticated
using (prive.peut_ecrire_cabinet(cabinet_id));

drop policy journal_audit_lecture on public.journal_audit;
create policy journal_audit_lecture on public.journal_audit for select to authenticated
using (
  prive.est_admin_plateforme()
  or (entreprise_id is not null and prive.administre_entreprise(entreprise_id)
      and prive.phase_entreprise(entreprise_id) <> 'bloque')
  or (entreprise_id is null and cabinet_id is not null and prive.est_admin_cabinet(cabinet_id)
      and prive.phase_cabinet(cabinet_id) <> 'bloque')
);

-- ---------------------------------------------------------------------
-- Droits et RLS des nouvelles tables
-- ---------------------------------------------------------------------
revoke all on public.formules, public.abonnements, public.inscriptions from anon, authenticated;
grant select on public.formules to anon;
grant select, insert, update on public.formules to authenticated;
grant select, insert, update on public.abonnements to authenticated;
grant select on public.inscriptions to authenticated;

alter table public.formules enable row level security;
alter table public.abonnements enable row level security;
alter table public.inscriptions enable row level security;

-- Formules : catalogue public (page d'inscription), modifiable par l'admin plateforme
create policy formules_lecture_publique on public.formules for select to anon using (actif);
create policy formules_lecture on public.formules for select to authenticated
using (actif or prive.est_admin_plateforme());
create policy formules_creation on public.formules for insert to authenticated
with check (prive.est_admin_plateforme());
create policy formules_modification on public.formules for update to authenticated
using (prive.est_admin_plateforme()) with check (prive.est_admin_plateforme());

-- Abonnements : visibles des administrateurs du titulaire (même bloqué, pour pouvoir payer),
-- modifiables uniquement par l'admin plateforme.
create policy abonnements_lecture on public.abonnements for select to authenticated
using (
  prive.est_admin_plateforme()
  or (cabinet_id is not null and prive.est_admin_cabinet(cabinet_id))
  or (entreprise_id is not null and prive.administre_entreprise(entreprise_id))
);
create policy abonnements_creation on public.abonnements for insert to authenticated
with check (prive.est_admin_plateforme());
create policy abonnements_modification on public.abonnements for update to authenticated
using (prive.est_admin_plateforme()) with check (prive.est_admin_plateforme());

create policy inscriptions_lecture on public.inscriptions for select to authenticated
using (profil_id = (select auth.uid()) or prive.est_admin_plateforme());

-- Journal d'audit sur les nouvelles tables
create trigger journaliser after insert or update or delete on public.formules
  for each row execute function prive.journaliser('', '');
create trigger journaliser after insert or update or delete on public.abonnements
  for each row execute function prive.journaliser('entreprise_id', 'cabinet_id');
create trigger journaliser after insert or update or delete on public.inscriptions
  for each row execute function prive.journaliser('entreprise_id', 'cabinet_id');

-- ---------------------------------------------------------------------
-- Finalisation d'une inscription libre
-- ---------------------------------------------------------------------
-- Appelée par la personne juste après avoir cliqué sur son lien d'activation.
-- Les informations d'inscription viennent de app_metadata dans le jeton de session :
-- elles ont été écrites par le serveur et ne peuvent pas être falsifiées par l'utilisateur.
create function public.finaliser_inscription()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inscription jsonb := auth.jwt() -> 'app_metadata' -> 'inscription';
  v_existante public.inscriptions;
  v_type text;
  v_nom text;
  v_formule text;
  v_essai public.formules;
  v_cabinet uuid;
  v_entreprise uuid;
begin
  if v_uid is null or v_inscription is null or jsonb_typeof(v_inscription) <> 'object' then
    raise exception 'Aucune inscription en attente.' using errcode = 'insufficient_privilege';
  end if;

  -- Déjà finalisée : on renvoie le résultat sans rien recréer.
  select * into v_existante from public.inscriptions where profil_id = v_uid;
  if found then
    return jsonb_build_object('type', v_existante.type, 'cabinet_id', v_existante.cabinet_id,
                              'entreprise_id', v_existante.entreprise_id);
  end if;

  v_type := v_inscription ->> 'type';
  v_nom := nullif(trim(v_inscription ->> 'nom_structure'), '');
  v_formule := coalesce(v_inscription ->> 'formule', 'essai');
  if v_type not in ('cabinet', 'entreprise') or v_nom is null then
    raise exception 'Inscription invalide.';
  end if;

  select * into strict v_essai from public.formules where code = 'essai';

  if v_type = 'cabinet' then
    insert into public.cabinets (nom, email) values (v_nom, auth.jwt() ->> 'email') returning id into v_cabinet;
    insert into public.membres_cabinet (cabinet_id, profil_id) values (v_cabinet, v_uid);
  else
    insert into public.entreprises (raison_sociale, mode, email)
    values (v_nom, 'autonome', auth.jwt() ->> 'email') returning id into v_entreprise;
    insert into public.affectations (entreprise_id, profil_id, role) values (v_entreprise, v_uid, 'admin_entreprise');
  end if;

  insert into public.abonnements (cabinet_id, entreprise_id, formule_id, statut, debut, fin, demande_pro_le)
  values (v_cabinet, v_entreprise, v_essai.id, 'essai', now(), now() + make_interval(days => v_essai.duree_jours),
          case when v_formule = 'pro' then now() end);

  insert into public.inscriptions (profil_id, type, cabinet_id, entreprise_id, formule_souhaitee)
  values (v_uid, v_type, v_cabinet, v_entreprise, v_formule);

  return jsonb_build_object('type', v_type, 'cabinet_id', v_cabinet, 'entreprise_id', v_entreprise);
end
$$;

-- Le client demande à passer à Pro (le paiement en ligne viendra plus tard).
create function public.demander_passage_pro(p_abonnement_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_abonnement public.abonnements;
begin
  select * into v_abonnement from public.abonnements where id = p_abonnement_id;
  if not found or not (
    (v_abonnement.cabinet_id is not null and prive.est_admin_cabinet(v_abonnement.cabinet_id))
    or (v_abonnement.entreprise_id is not null and prive.administre_entreprise(v_abonnement.entreprise_id))
  ) then
    raise exception 'Action non autorisée.' using errcode = 'insufficient_privilege';
  end if;
  update public.abonnements set demande_pro_le = now() where id = p_abonnement_id;
end
$$;

-- Abonnements de la personne connectée (ou tous, pour l'admin plateforme), avec leur phase.
create function public.mes_abonnements()
returns table (
  abonnement_id uuid,
  titulaire text,
  cabinet_id uuid,
  entreprise_id uuid,
  formule_id uuid,
  formule text,
  statut public.statut_abonnement,
  debut timestamptz,
  fin timestamptz,
  phase text,
  jours_restants integer,
  fin_lecture_seule timestamptz,
  demande_pro_le timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select a.id, coalesce(c.nom, e.raison_sociale), a.cabinet_id, a.entreprise_id, f.id, f.libelle, a.statut,
         a.debut, a.fin, prive.phase_abonnement(a.statut, a.fin),
         greatest(0, ceil(extract(epoch from (a.fin - now())) / 86400))::integer,
         a.fin + interval '30 days', a.demande_pro_le
  from public.abonnements a
  join public.formules f on f.id = a.formule_id
  left join public.cabinets c on c.id = a.cabinet_id
  left join public.entreprises e on e.id = a.entreprise_id
  where prive.est_admin_plateforme()
     or (a.cabinet_id is not null and prive.est_admin_cabinet(a.cabinet_id))
     or (a.entreprise_id is not null and prive.administre_entreprise(a.entreprise_id))
  order by a.fin
$$;

revoke all on function public.finaliser_inscription() from public, anon;
revoke all on function public.demander_passage_pro(uuid) from public, anon;
revoke all on function public.mes_abonnements() from public, anon;
grant execute on function public.finaliser_inscription() to authenticated;
grant execute on function public.demander_passage_pro(uuid) to authenticated;
grant execute on function public.mes_abonnements() to authenticated;
