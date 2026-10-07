-- =====================================================================
-- Étape 3 : journal d'audit non modifiable
-- =====================================================================
-- Chaque création, modification ou suppression dans une table métier
-- ajoute automatiquement une ligne : qui, quand, quoi, avant, après.
-- Personne ne peut modifier ni supprimer une ligne du journal.
-- Chaque ligne contient l'empreinte (SHA-256) de la précédente :
-- toute falsification de l'historique devient détectable.

create table public.journal_audit (
  id bigint generated always as identity primary key,
  horodatage timestamptz not null,
  auteur_id uuid,          -- vide = action système (migration, script d'administration)
  auteur_role text,
  action text not null,    -- INSERT, UPDATE, DELETE
  table_nom text not null,
  enregistrement_id text,
  entreprise_id uuid,
  cabinet_id uuid,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  hash_precedent text,
  hash text not null
);
create index journal_audit_entreprise_idx on public.journal_audit (entreprise_id, horodatage desc);
create index journal_audit_cabinet_idx on public.journal_audit (cabinet_id, horodatage desc);
create index journal_audit_auteur_idx on public.journal_audit (auteur_id, horodatage desc);

-- ---------------------------------------------------------------------
-- Empreinte d'une ligne (même calcul à l'écriture et à la vérification)
-- ---------------------------------------------------------------------
create function prive.empreinte_audit(
  p_hash_precedent text, p_id bigint, p_horodatage timestamptz,
  p_auteur_id uuid, p_auteur_role text, p_action text, p_table_nom text,
  p_enregistrement_id text, p_entreprise_id uuid, p_cabinet_id uuid,
  p_ancienne_valeur jsonb, p_nouvelle_valeur jsonb
)
returns text
language sql stable set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(
    p_hash_precedent, p_id, (extract(epoch from p_horodatage) * 1000000)::bigint,
    p_auteur_id, p_auteur_role, p_action, p_table_nom, p_enregistrement_id,
    p_entreprise_id, p_cabinet_id, p_ancienne_valeur, p_nouvelle_valeur
  )::text, 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------------
-- Déclencheur générique d'écriture dans le journal
-- Arguments : colonne de l'entreprise concernée, colonne du cabinet ('' si aucune)
-- ---------------------------------------------------------------------
create function prive.journaliser()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ancien jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_nouveau jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_ligne jsonb := coalesce(v_nouveau, v_ancien);
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_auteur_id uuid := (v_claims ->> 'sub')::uuid;
  v_auteur_role text := v_claims ->> 'role';
  v_entreprise_id uuid := case when tg_argv[0] <> '' then (v_ligne ->> tg_argv[0])::uuid end;
  v_cabinet_id uuid := case when tg_argv[1] <> '' then (v_ligne ->> tg_argv[1])::uuid end;
  v_enregistrement_id text := v_ligne ->> 'id';
  v_horodatage timestamptz;
  v_precedent text;
  v_id bigint;
begin
  if tg_op = 'UPDATE' and v_ancien = v_nouveau then
    return null;  -- rien n'a changé, rien à tracer
  end if;

  -- Une seule écriture à la fois dans le journal, pour garder la chaîne d'empreintes intacte
  perform pg_advisory_xact_lock(hashtext('public.journal_audit'));

  select j.hash into v_precedent from public.journal_audit j order by j.id desc limit 1;
  v_id := nextval(pg_get_serial_sequence('public.journal_audit', 'id'));
  v_horodatage := clock_timestamp();

  insert into public.journal_audit overriding system value values (
    v_id, v_horodatage, v_auteur_id, v_auteur_role, tg_op, tg_table_name,
    v_enregistrement_id, v_entreprise_id, v_cabinet_id, v_ancien, v_nouveau, v_precedent,
    prive.empreinte_audit(
      v_precedent, v_id, v_horodatage, v_auteur_id, v_auteur_role, tg_op, tg_table_name,
      v_enregistrement_id, v_entreprise_id, v_cabinet_id, v_ancien, v_nouveau
    )
  );
  return null;
end
$$;

-- ---------------------------------------------------------------------
-- Vérification de la chaîne : renvoie l'id de la première ligne altérée,
-- ou null si tout le journal est intact.
-- ---------------------------------------------------------------------
create function prive.verifier_journal_audit()
returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.journal_audit;
  v_precedent text := null;
begin
  for l in select * from public.journal_audit order by id loop
    if l.hash_precedent is distinct from v_precedent
       or l.hash <> prive.empreinte_audit(
         l.hash_precedent, l.id, l.horodatage, l.auteur_id, l.auteur_role, l.action,
         l.table_nom, l.enregistrement_id, l.entreprise_id, l.cabinet_id,
         l.ancienne_valeur, l.nouvelle_valeur
       ) then
      return l.id;
    end if;
    v_precedent := l.hash;
  end loop;
  return null;
end
$$;

-- ---------------------------------------------------------------------
-- Interdiction absolue de modifier, supprimer ou vider le journal
-- (s'applique à tout le monde, y compris l'administrateur de la base)
-- ---------------------------------------------------------------------
create function prive.interdire_modification_journal()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Le journal d''audit est non modifiable : % interdit.', tg_op
    using errcode = 'insufficient_privilege';
end
$$;

create trigger journal_audit_non_modifiable
  before update or delete on public.journal_audit
  for each row execute function prive.interdire_modification_journal();

create trigger journal_audit_non_vidable
  before truncate on public.journal_audit
  for each statement execute function prive.interdire_modification_journal();

revoke all on function prive.empreinte_audit(text, bigint, timestamptz, uuid, text, text, text, text, uuid, uuid, jsonb, jsonb) from public;
revoke all on function prive.journaliser() from public;
revoke all on function prive.verifier_journal_audit() from public;
revoke all on function prive.interdire_modification_journal() from public;

-- ---------------------------------------------------------------------
-- Branchement sur les tables existantes
-- ---------------------------------------------------------------------
create trigger journaliser after insert or update or delete on public.profils
  for each row execute function prive.journaliser('', '');
create trigger journaliser after insert or update or delete on public.cabinets
  for each row execute function prive.journaliser('', 'id');
create trigger journaliser after insert or update or delete on public.membres_cabinet
  for each row execute function prive.journaliser('', 'cabinet_id');
create trigger journaliser after insert or update or delete on public.entreprises
  for each row execute function prive.journaliser('id', 'cabinet_id');
create trigger journaliser after insert or update or delete on public.affectations
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Droits et lecture
-- ---------------------------------------------------------------------
revoke all on public.journal_audit from anon, authenticated;
grant select on public.journal_audit to authenticated;

alter table public.journal_audit enable row level security;

-- Admin plateforme : tout. Admin cabinet : les entreprises qu'il gère aujourd'hui,
-- et les actions sur son cabinet lui-même. Si une entreprise quitte le cabinet,
-- son historique n'est plus visible du cabinet.
create policy journal_audit_lecture on public.journal_audit for select to authenticated
using (
  prive.est_admin_plateforme()
  or (entreprise_id is not null and prive.gere_entreprise(entreprise_id))
  or (entreprise_id is null and cabinet_id is not null and prive.est_admin_cabinet(cabinet_id))
);
