-- Création d'une entreprise depuis la page de connexion :
--   * N° CNAMGS employeur sur la fiche entreprise ;
--   * paie autonome : inscription habituelle, avec la fiche complète ;
--   * paie gérée par un cabinet : une demande est transmise au cabinet choisi, qui l'accepte
--     (l'entreprise est alors créée chez lui), la refuse ou demande des informations.

alter table public.entreprises add column if not exists numero_cnamgs text;

-- ---------------------------------------------------------------------
-- Demandes de prise en charge adressées à un cabinet
-- ---------------------------------------------------------------------
create table public.demandes_entreprise (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.cabinets (id) on delete cascade,
  raison_sociale text not null check (length(trim(raison_sociale)) between 1 and 200),
  nif text,
  rccm text,
  numero_cnss text,
  numero_cnamgs text,
  adresse text,
  telephone text,
  email text,
  nb_salaries integer not null check (nb_salaries between 1 and 100000),
  contact_nom text not null check (length(trim(contact_nom)) between 1 and 120),
  contact_email text not null check (contact_email like '%@%'),
  contact_telephone text,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  entreprise_id uuid references public.entreprises (id) on delete set null,
  traitee_par uuid references public.profils (id) on delete set null,
  traitee_le timestamptz,
  informations_demandees_le timestamptz,
  cree_le timestamptz not null default now()
);
create index demandes_entreprise_cabinet_idx on public.demandes_entreprise (cabinet_id, statut);

alter table public.demandes_entreprise enable row level security;

-- Lecture : les administrateurs du cabinet concerné (et l'administrateur plateforme).
-- Aucune écriture directe : dépôt par le serveur, traitement par les fonctions ci-dessous.
create policy demandes_entreprise_lecture on public.demandes_entreprise
  for select to authenticated
  using (prive.est_admin_cabinet(cabinet_id) or prive.est_admin_plateforme());

revoke all on public.demandes_entreprise from public, anon, authenticated;
grant select on public.demandes_entreprise to authenticated;

create trigger journaliser after insert or update or delete on public.demandes_entreprise
  for each row execute function prive.journaliser('', 'cabinet_id');

-- Cabinets proposés dans le formulaire public (nom seulement)
create function public.cabinets_disponibles()
returns table (id uuid, nom text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.nom from public.cabinets c order by c.nom
$$;
revoke all on function public.cabinets_disponibles() from public;
grant execute on function public.cabinets_disponibles() to anon, authenticated;

-- Acceptation : l'entreprise est créée chez le cabinet (paie gérée par le cabinet).
create function public.accepter_demande_entreprise(p_demande_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_demande public.demandes_entreprise;
  v_entreprise uuid;
begin
  select * into v_demande from public.demandes_entreprise where id = p_demande_id for update;
  if not found or not (prive.est_admin_cabinet(v_demande.cabinet_id) or prive.est_admin_plateforme()) then
    raise exception 'Action non autorisée.' using errcode = 'insufficient_privilege';
  end if;
  if v_demande.statut <> 'en_attente' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  insert into public.entreprises (cabinet_id, raison_sociale, nif, rccm, numero_cnss, numero_cnamgs, adresse, telephone, email, mode)
  values (v_demande.cabinet_id, v_demande.raison_sociale, v_demande.nif, v_demande.rccm, v_demande.numero_cnss,
          v_demande.numero_cnamgs, v_demande.adresse, v_demande.telephone, v_demande.email, 'cabinet')
  returning id into v_entreprise;

  update public.demandes_entreprise
  set statut = 'acceptee', entreprise_id = v_entreprise, traitee_par = auth.uid(), traitee_le = now()
  where id = p_demande_id;
  return v_entreprise;
end
$$;

create function public.refuser_demande_entreprise(p_demande_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_demande public.demandes_entreprise;
begin
  select * into v_demande from public.demandes_entreprise where id = p_demande_id for update;
  if not found or not (prive.est_admin_cabinet(v_demande.cabinet_id) or prive.est_admin_plateforme()) then
    raise exception 'Action non autorisée.' using errcode = 'insufficient_privilege';
  end if;
  if v_demande.statut <> 'en_attente' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;
  update public.demandes_entreprise set statut = 'refusee', traitee_par = auth.uid(), traitee_le = now()
  where id = p_demande_id;
end
$$;

-- Trace de l'email « demande d'informations » envoyé à l'entreprise
create function public.noter_demande_informations(p_demande_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_demande public.demandes_entreprise;
begin
  select * into v_demande from public.demandes_entreprise where id = p_demande_id;
  if not found or not (prive.est_admin_cabinet(v_demande.cabinet_id) or prive.est_admin_plateforme()) then
    raise exception 'Action non autorisée.' using errcode = 'insufficient_privilege';
  end if;
  update public.demandes_entreprise set informations_demandees_le = now() where id = p_demande_id;
end
$$;

revoke all on function public.accepter_demande_entreprise(uuid), public.refuser_demande_entreprise(uuid),
  public.noter_demande_informations(uuid) from public, anon;
grant execute on function public.accepter_demande_entreprise(uuid), public.refuser_demande_entreprise(uuid),
  public.noter_demande_informations(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Inscription d'une entreprise autonome : la fiche complète est reprise
-- ---------------------------------------------------------------------
create or replace function public.finaliser_inscription()
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
  v_fiche jsonb;
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
  v_fiche := case when jsonb_typeof(v_inscription -> 'fiche') = 'object' then v_inscription -> 'fiche' else '{}'::jsonb end;
  if v_type not in ('cabinet', 'entreprise') or v_nom is null then
    raise exception 'Inscription invalide.';
  end if;

  select * into strict v_essai from public.formules where code = 'essai';

  if v_type = 'cabinet' then
    insert into public.cabinets (nom, email) values (v_nom, auth.jwt() ->> 'email') returning id into v_cabinet;
    insert into public.membres_cabinet (cabinet_id, profil_id) values (v_cabinet, v_uid);
  else
    -- Fiche complète saisie dans « Créer une nouvelle entreprise » (facultative)
    insert into public.entreprises (raison_sociale, mode, email, nif, rccm, numero_cnss, numero_cnamgs, adresse, telephone)
    values (v_nom, 'autonome', coalesce(nullif(trim(v_fiche ->> 'email'), ''), auth.jwt() ->> 'email'),
            nullif(trim(v_fiche ->> 'nif'), ''), nullif(trim(v_fiche ->> 'rccm'), ''),
            nullif(trim(v_fiche ->> 'numero_cnss'), ''), nullif(trim(v_fiche ->> 'numero_cnamgs'), ''),
            nullif(trim(v_fiche ->> 'adresse'), ''), nullif(trim(v_fiche ->> 'telephone'), ''))
    returning id into v_entreprise;
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
