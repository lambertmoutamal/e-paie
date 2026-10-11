-- =====================================================================
-- Étape 8 : circuit de validation des périodes de paie
-- =====================================================================
-- Chaque entreprise définit son circuit : 1 à 5 étapes, chacune validée par un rôle.
-- Le circuit est figé dans la période au moment de l'envoi en validation.
-- Séparation des tâches : ni l'émetteur, ni un déposant de bulletins, ni le
-- validateur d'une autre étape ne peut valider. Un refus (commentaire obligatoire)
-- renvoie à l'étape précédente ; la dernière validation approuve et verrouille.
-- Toutes les transitions passent par des fonctions : aucune mise à jour directe.

-- ---------------------------------------------------------------------
-- Réglage du circuit par entreprise
-- ---------------------------------------------------------------------
create table public.etapes_circuit (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  ordre integer not null check (ordre between 1 and 5),
  libelle text not null check (char_length(btrim(libelle)) between 2 and 60),
  -- rôle de l'entreprise, ou « administrateur » (cabinet ou administrateur de l'entreprise)
  role text not null check (role in ('controleur', 'signataire', 'rh', 'admin_entreprise', 'administrateur')),
  unique (entreprise_id, ordre)
);

alter table public.etapes_circuit enable row level security;
revoke all on public.etapes_circuit from anon, authenticated;
grant select on public.etapes_circuit to authenticated;
create policy etapes_lecture on public.etapes_circuit for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));

create trigger journaliser after insert or update or delete on public.etapes_circuit
  for each row execute function prive.journaliser('entreprise_id', '');

-- Circuit en vigueur (circuit par défaut si l'entreprise n'a rien réglé)
create function prive.circuit_entreprise(p_entreprise_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('libelle', c.libelle, 'role', c.role) order by c.ordre)
     from public.etapes_circuit c where c.entreprise_id = p_entreprise_id),
    '[{"libelle": "Contrôle", "role": "controleur"}, {"libelle": "Approbation", "role": "signataire"}]'::jsonb
  )
$$;

create function public.circuit_entreprise(p_entreprise_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$ select case when prive.a_acces_entreprise(p_entreprise_id) then prive.circuit_entreprise(p_entreprise_id) end $$;

-- Remplace le circuit d'une entreprise (administrateurs uniquement)
create function public.definir_circuit(p_entreprise_id uuid, p_etapes jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_etape jsonb;
  v_ordre integer := 0;
begin
  if not prive.gere_entreprise(p_entreprise_id) then
    raise exception 'Seuls les administrateurs peuvent régler le circuit de validation.';
  end if;
  if jsonb_typeof(p_etapes) <> 'array' or jsonb_array_length(p_etapes) not between 1 and 5 then
    raise exception 'Le circuit doit compter de 1 à 5 étapes.';
  end if;
  delete from public.etapes_circuit where entreprise_id = p_entreprise_id;
  for v_etape in select value from jsonb_array_elements(p_etapes) loop
    v_ordre := v_ordre + 1;
    insert into public.etapes_circuit (entreprise_id, ordre, libelle, role)
    values (p_entreprise_id, v_ordre, btrim(v_etape ->> 'libelle'), v_etape ->> 'role');
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- État de validation porté par la période
-- ---------------------------------------------------------------------
alter table public.periodes_paie
  add column circuit jsonb,
  add column etape_courante integer,
  add column validateurs uuid[] not null default '{}',
  add column cycle integer not null default 0,
  add column soumis_par uuid references public.profils (id) on delete set null,
  add column soumis_le timestamptz,
  add column approuvee_le timestamptz;

-- À la création, seuls l'entreprise, le mois et le créateur sont fournis.
revoke insert on public.periodes_paie from authenticated;
grant insert (entreprise_id, annee, mois, cree_par) on public.periodes_paie to authenticated;

-- Historique du circuit (envois, validations, refus), en lecture seule.
create table public.validations_periode (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.periodes_paie (id) on delete restrict,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  cycle integer not null,
  etape integer not null,
  libelle_etape text not null,
  action text not null check (action in ('soumission', 'validation', 'refus')),
  commentaire text check (commentaire is null or char_length(commentaire) <= 1000),
  auteur uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now()
);
create index validations_periode_idx on public.validations_periode (periode_id, cree_le);

alter table public.validations_periode enable row level security;
revoke all on public.validations_periode from anon, authenticated;
grant select on public.validations_periode to authenticated;
create policy validations_lecture on public.validations_periode for select to authenticated
using (prive.a_acces_entreprise(entreprise_id));

create trigger journaliser after insert or update or delete on public.validations_periode
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Droit de valider ou refuser l'étape en cours : renvoie le motif du refus,
-- ou null si la personne connectée peut agir.
-- ---------------------------------------------------------------------
create function prive.motif_blocage_validation(p_periode_id uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  v_moi uuid := (select auth.uid());
  v_role text;
  v_autorise boolean;
begin
  select * into p from public.periodes_paie where id = p_periode_id;
  if not found or not prive.a_acces_entreprise(p.entreprise_id) then
    return 'Période introuvable.';
  end if;
  if p.statut <> 'en_validation' then
    return 'Cette période n''est pas en cours de validation.';
  end if;
  if not prive.ecriture_permise(prive.phase_entreprise(p.entreprise_id)) then
    return 'L''abonnement ne permet plus de valider.';
  end if;

  v_role := p.circuit -> (p.etape_courante - 1) ->> 'role';
  v_autorise := case v_role
    when 'administrateur' then prive.administre_entreprise(p.entreprise_id)
    else prive.a_role_entreprise(p.entreprise_id, array[v_role]::public.role_entreprise[])
  end;
  if not coalesce(v_autorise, false) then
    return 'Cette étape doit être validée par une autre personne (rôle requis).';
  end if;

  if v_moi = p.soumis_par then
    return 'Vous avez envoyé cette période en validation : une autre personne doit la valider.';
  end if;
  if exists (select 1 from public.bulletins b where b.periode_id = p.id and b.depose_par = v_moi) then
    return 'Vous avez déposé des bulletins de cette période : une autre personne doit la valider.';
  end if;
  if v_moi = any (p.validateurs) then
    return 'Vous avez déjà validé une autre étape de cette période.';
  end if;
  return null;
end
$$;

create function public.motif_blocage_validation(p_periode_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select prive.motif_blocage_validation(p_periode_id) $$;

-- ---------------------------------------------------------------------
-- Transitions
-- ---------------------------------------------------------------------
create function public.soumettre_periode(p_periode_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  v_circuit jsonb;
begin
  select * into p from public.periodes_paie where id = p_periode_id for update;
  if not found or not prive.peut_deposer_bulletins(p.entreprise_id) then
    raise exception 'Vous ne pouvez pas envoyer cette période en validation.';
  end if;
  if p.statut <> 'brouillon' then
    raise exception 'Cette période a déjà été envoyée en validation.';
  end if;
  if not exists (select 1 from public.bulletins b where b.periode_id = p.id) then
    raise exception 'Déposez au moins un bulletin avant d''envoyer la période en validation.';
  end if;

  v_circuit := prive.circuit_entreprise(p.entreprise_id);
  update public.periodes_paie
     set statut = 'en_validation', circuit = v_circuit, etape_courante = 1, validateurs = '{}',
         cycle = p.cycle + 1, soumis_par = (select auth.uid()), soumis_le = now()
   where id = p.id;
  insert into public.validations_periode (periode_id, entreprise_id, cycle, etape, libelle_etape, action, auteur)
  values (p.id, p.entreprise_id, p.cycle + 1, 0, 'Envoi en validation', 'soumission', (select auth.uid()));
end
$$;

create function public.valider_etape(p_periode_id uuid, p_commentaire text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  v_motif text;
  v_validateurs uuid[];
  v_derniere boolean;
begin
  select * into p from public.periodes_paie where id = p_periode_id for update;
  v_motif := prive.motif_blocage_validation(p_periode_id);
  if v_motif is not null then raise exception '%', v_motif; end if;

  v_validateurs := p.validateurs;
  v_validateurs[p.etape_courante] := (select auth.uid());
  v_derniere := p.etape_courante >= jsonb_array_length(p.circuit);

  insert into public.validations_periode (periode_id, entreprise_id, cycle, etape, libelle_etape, action, commentaire, auteur)
  values (p.id, p.entreprise_id, p.cycle, p.etape_courante, p.circuit -> (p.etape_courante - 1) ->> 'libelle',
          'validation', nullif(btrim(p_commentaire), ''), (select auth.uid()));

  if v_derniere then
    update public.periodes_paie
       set statut = 'approuvee', etape_courante = null, validateurs = v_validateurs, approuvee_le = now()
     where id = p.id;
    return 'approuvee';
  end if;
  update public.periodes_paie set etape_courante = p.etape_courante + 1, validateurs = v_validateurs where id = p.id;
  return 'etape_suivante';
end
$$;

create function public.refuser_etape(p_periode_id uuid, p_commentaire text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  v_motif text;
  v_validateurs uuid[];
begin
  select * into p from public.periodes_paie where id = p_periode_id for update;
  v_motif := prive.motif_blocage_validation(p_periode_id);
  if v_motif is not null then raise exception '%', v_motif; end if;
  if char_length(btrim(coalesce(p_commentaire, ''))) < 5 then
    raise exception 'Expliquez le motif du refus (5 caractères au moins).';
  end if;

  insert into public.validations_periode (periode_id, entreprise_id, cycle, etape, libelle_etape, action, commentaire, auteur)
  values (p.id, p.entreprise_id, p.cycle, p.etape_courante, p.circuit -> (p.etape_courante - 1) ->> 'libelle',
          'refus', left(btrim(p_commentaire), 1000), (select auth.uid()));

  -- Retour à l'étape précédente, dont la validation est annulée.
  if p.etape_courante = 1 then
    update public.periodes_paie set statut = 'brouillon', etape_courante = null, validateurs = '{}' where id = p.id;
    return 'brouillon';
  end if;
  v_validateurs := p.validateurs;
  v_validateurs[p.etape_courante - 1] := null;
  update public.periodes_paie set etape_courante = p.etape_courante - 1, validateurs = v_validateurs where id = p.id;
  return 'etape_precedente';
end
$$;

revoke all on function
  prive.circuit_entreprise(uuid),
  prive.motif_blocage_validation(uuid)
from public;
revoke all on function
  public.circuit_entreprise(uuid),
  public.definir_circuit(uuid, jsonb),
  public.motif_blocage_validation(uuid),
  public.soumettre_periode(uuid),
  public.valider_etape(uuid, text),
  public.refuser_etape(uuid, text)
from public, anon;
grant execute on function
  public.circuit_entreprise(uuid),
  public.definir_circuit(uuid, jsonb),
  public.motif_blocage_validation(uuid),
  public.soumettre_periode(uuid),
  public.valider_etape(uuid, text),
  public.refuser_etape(uuid, text)
to authenticated;
