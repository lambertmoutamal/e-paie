-- =====================================================================
-- Réglages personnalisables des congés
-- =====================================================================
--   • jours d'ancienneté (par tranche d'années de présence, avec plafond) ;
--   • règles des demandes : délai de prévenance, solde négatif autorisé ou non,
--     report maximum d'une année de congés sur la suivante ;
--   • qui valide : le RH, les administrateurs, ou le RH puis un administrateur.

alter table public.parametres_conges
  add column anciennete_tranche_ans integer check (anciennete_tranche_ans is null or anciennete_tranche_ans between 1 and 40),
  add column anciennete_jours_par_tranche numeric(4, 2) not null default 0 check (anciennete_jours_par_tranche between 0 and 10),
  add column anciennete_plafond numeric(4, 1) check (anciennete_plafond is null or anciennete_plafond >= 0),
  add column delai_prevenance_jours integer not null default 0 check (delai_prevenance_jours between 0 and 365),
  add column solde_negatif_autorise boolean not null default true,
  add column report_max_jours numeric(5, 1) check (report_max_jours is null or report_max_jours >= 0),
  add column mois_debut_reference integer not null default 1 check (mois_debut_reference between 1 and 12),
  add column validation_absences text not null default 'rh'
    check (validation_absences in ('rh', 'administrateurs', 'rh_puis_administrateur'));

grant update (anciennete_tranche_ans, anciennete_jours_par_tranche, anciennete_plafond, delai_prevenance_jours,
              solde_negatif_autorise, report_max_jours, mois_debut_reference, validation_absences)
  on public.parametres_conges to authenticated;

-- Seul un administrateur choisit qui valide les demandes (le RH ne peut pas s'en retirer le contrôle)
create function prive.proteger_mode_validation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.validation_absences is distinct from old.validation_absences
     and current_user = 'authenticated' and not prive.gere_entreprise(new.entreprise_id) then
    raise exception 'Seul un administrateur peut choisir qui valide les demandes.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger parametres_conges_mode before update on public.parametres_conges
  for each row execute function prive.proteger_mode_validation();

-- Pré-validation par le RH (mode « RH puis administrateur »)
alter table public.demandes_absence
  add column prevalidee_par uuid references public.profils (id) on delete set null,
  add column prevalidee_le timestamptz;

-- ---------------------------------------------------------------------
-- Solde de congés : calcul mois par mois (acquisition, ancienneté, report)
-- ---------------------------------------------------------------------
drop function public.soldes_entreprise(uuid);
drop function public.mon_solde_conges(uuid);
drop function prive.solde_conges(uuid);

create function prive.solde_conges(p_salarie_id uuid)
returns table (date_reference date, solde_initial numeric, acquis numeric, anciennete numeric, pris numeric,
               perdu numeric, en_attente numeric, disponible numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  s public.salaries;
  p public.parametres_conges;
  v_ref date;
  v_initial numeric;
  v_par_mois numeric;
  v_fin date;
  v_k integer := 1;
  v_debut_mois date;
  v_echeance date;
  v_courant numeric;
  v_acquis numeric := 0;
  v_anciennete numeric := 0;
  v_pris_mois numeric;
  v_perdu numeric := 0;
  v_annees integer;
  v_bonus numeric;
  v_frontiere date;
  v_pris numeric;
  v_attente numeric;
begin
  select * into s from public.salaries where id = p_salarie_id;
  if not found then return; end if;
  select * into p from public.parametres_conges c where c.entreprise_id = s.entreprise_id;
  select i.date_reference, i.jours into v_ref, v_initial from public.soldes_conges_initiaux i where i.salarie_id = s.id;
  v_ref := coalesce(v_ref, s.date_embauche);
  v_initial := coalesce(v_initial, 0);
  v_par_mois := coalesce(p.jours_par_mois, 2);
  v_fin := least(current_date, coalesce(s.date_sortie, current_date));
  v_courant := v_initial;
  v_debut_mois := v_ref;

  -- Chaque mois complet : acquisition (+ ancienneté), congés pris, puis report plafonné
  -- au début de chaque nouvelle année de congés.
  loop
    v_echeance := (v_ref + make_interval(months => v_k))::date;
    exit when v_echeance > v_fin;

    v_acquis := v_acquis + v_par_mois;
    v_courant := v_courant + v_par_mois;
    if p.anciennete_tranche_ans is not null and p.anciennete_jours_par_tranche > 0 then
      v_annees := extract(year from age(v_echeance, s.date_embauche))::integer;
      v_bonus := floor(v_annees / p.anciennete_tranche_ans) * p.anciennete_jours_par_tranche;
      if p.anciennete_plafond is not null then v_bonus := least(v_bonus, p.anciennete_plafond); end if;
      v_anciennete := v_anciennete + v_bonus / 12;
      v_courant := v_courant + v_bonus / 12;
    end if;

    select coalesce(sum(d.nb_jours), 0) into v_pris_mois
      from public.demandes_absence d join public.types_absence t on t.id = d.type_id
     where d.salarie_id = s.id and t.deduit_solde and d.statut = 'acceptee'
       and d.debut >= v_debut_mois and d.debut < v_echeance;
    v_courant := v_courant - v_pris_mois;

    if p.report_max_jours is not null then
      v_frontiere := make_date(extract(year from v_echeance)::integer, coalesce(p.mois_debut_reference, 1), 1);
      if v_frontiere > v_debut_mois and v_frontiere <= v_echeance and v_courant > p.report_max_jours then
        v_perdu := v_perdu + (v_courant - p.report_max_jours);
        v_courant := p.report_max_jours;
      end if;
    end if;

    v_debut_mois := v_echeance;
    v_k := v_k + 1;
  end loop;

  -- Congés acceptés à partir du dernier mois (y compris à venir)
  select coalesce(sum(d.nb_jours), 0) into v_pris_mois
    from public.demandes_absence d join public.types_absence t on t.id = d.type_id
   where d.salarie_id = s.id and t.deduit_solde and d.statut = 'acceptee' and d.debut >= v_debut_mois;
  v_courant := v_courant - v_pris_mois;

  select coalesce(sum(d.nb_jours) filter (where d.statut = 'acceptee'), 0),
         coalesce(sum(d.nb_jours) filter (where d.statut = 'en_attente'), 0)
    into v_pris, v_attente
    from public.demandes_absence d join public.types_absence t on t.id = d.type_id
   where d.salarie_id = s.id and t.deduit_solde and d.debut >= v_ref;

  return query select v_ref, v_initial, v_acquis, round(v_anciennete, 2), v_pris, round(v_perdu, 2), v_attente, round(v_courant, 2);
end
$$;
revoke all on function prive.solde_conges(uuid) from public;

create function public.soldes_entreprise(p_entreprise_id uuid)
returns table (salarie_id uuid, date_reference date, solde_initial numeric, acquis numeric, anciennete numeric, pris numeric,
               perdu numeric, en_attente numeric, disponible numeric)
language sql stable security definer set search_path = ''
as $$
  select s.id, c.*
  from public.salaries s, lateral prive.solde_conges(s.id) c
  where s.entreprise_id = p_entreprise_id and prive.a_acces_entreprise(p_entreprise_id)
$$;

create function public.mon_solde_conges(p_salarie_id uuid)
returns table (date_reference date, solde_initial numeric, acquis numeric, anciennete numeric, pris numeric,
               perdu numeric, en_attente numeric, disponible numeric)
language sql stable security definer set search_path = ''
as $$ select c.* from prive.solde_conges(p_salarie_id) c where prive.est_mon_salarie(p_salarie_id) $$;

revoke all on function public.soldes_entreprise(uuid), public.mon_solde_conges(uuid) from public, anon;
grant execute on function public.soldes_entreprise(uuid), public.mon_solde_conges(uuid) to authenticated;

-- Le solde suffit-il ? (toujours vrai si le solde négatif est autorisé ou si le type n'est pas décompté)
create function prive.solde_suffisant(p_salarie_id uuid, p_type_id uuid, p_jours numeric, p_compter_attente boolean)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_autorise boolean;
  v_deduit boolean;
  c record;
begin
  select coalesce(p.solde_negatif_autorise, true) into v_autorise
    from public.salaries s left join public.parametres_conges p on p.entreprise_id = s.entreprise_id where s.id = p_salarie_id;
  select t.deduit_solde into v_deduit from public.types_absence t where t.id = p_type_id;
  if coalesce(v_autorise, true) or not coalesce(v_deduit, false) then return true; end if;
  select * into c from prive.solde_conges(p_salarie_id);
  return p_jours <= c.disponible - case when p_compter_attente then c.en_attente else 0 end;
end
$$;
revoke all on function prive.solde_suffisant(uuid, uuid, numeric, boolean) from public;

-- ---------------------------------------------------------------------
-- Qui traite une demande, selon le mode choisi par l'entreprise
-- ---------------------------------------------------------------------
create function prive.mode_validation_absences(p_entreprise_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select c.validation_absences from public.parametres_conges c where c.entreprise_id = p_entreprise_id), 'rh') $$;

-- Étape « administrateur » ? (mode administrateurs, ou demande déjà pré-validée par le RH)
create function prive.etape_administrateur(d public.demandes_absence)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.mode_validation_absences(d.entreprise_id) = 'administrateurs'
    or (prive.mode_validation_absences(d.entreprise_id) = 'rh_puis_administrateur' and d.prevalidee_par is not null)
$$;

-- La personne connectée peut-elle décider (accepter / refuser) cette demande ?
create function prive.peut_decider_demande(d public.demandes_absence)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_rh boolean := prive.a_role_entreprise(d.entreprise_id, array['rh']::public.role_entreprise[])
                  and prive.ecriture_permise(prive.phase_entreprise(d.entreprise_id));
  v_admin boolean := prive.gere_entreprise(d.entreprise_id);
  v_rh_existe boolean := exists (select 1 from public.affectations a where a.entreprise_id = d.entreprise_id and a.actif and a.role = 'rh');
begin
  if prive.etape_administrateur(d) then
    return v_admin and (d.prevalidee_par is null or d.prevalidee_par <> (select auth.uid()));
  end if;
  if prive.mode_validation_absences(d.entreprise_id) = 'rh_puis_administrateur' then
    return v_rh or (not v_rh_existe and v_admin);
  end if;
  return v_rh or v_admin;  -- mode « RH » : les administrateurs peuvent aussi décider
end
$$;

-- La demande doit-elle apparaître dans « À faire » de la personne connectée ?
create function prive.doit_traiter_demande(d public.demandes_absence)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_rh_existe boolean := exists (select 1 from public.affectations a where a.entreprise_id = d.entreprise_id and a.actif and a.role = 'rh');
  v_admin boolean := prive.administre_entreprise(d.entreprise_id) and not prive.est_admin_plateforme();
begin
  if d.statut <> 'en_attente' or not prive.ecriture_permise(prive.phase_entreprise(d.entreprise_id)) then return false; end if;
  if prive.etape_administrateur(d) then
    return v_admin and (d.prevalidee_par is null or d.prevalidee_par <> (select auth.uid()));
  end if;
  return prive.a_role_entreprise(d.entreprise_id, array['rh']::public.role_entreprise[]) or (not v_rh_existe and v_admin);
end
$$;

revoke all on function prive.mode_validation_absences(uuid), prive.etape_administrateur(public.demandes_absence),
  prive.peut_decider_demande(public.demandes_absence), prive.doit_traiter_demande(public.demandes_absence) from public;

-- Décision : « prevalidee » (étape RH du mode à deux validations), « acceptee » ou « refusee »
drop function public.decider_demande(uuid, boolean, text);
create function public.decider_demande(p_demande_id uuid, p_accepter boolean, p_commentaire text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  d public.demandes_absence;
begin
  select * into d from public.demandes_absence where id = p_demande_id for update;
  if not found or not prive.peut_decider_demande(d) then
    raise exception 'Vous ne pouvez pas traiter cette demande.';
  end if;
  if d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée.'; end if;
  if not p_accepter and char_length(btrim(coalesce(p_commentaire, ''))) < 5 then
    raise exception 'Expliquez le motif du refus (5 caractères au moins).';
  end if;
  if p_accepter and not prive.solde_suffisant(d.salarie_id, d.type_id, d.nb_jours, false) then
    raise exception 'Solde de congés insuffisant : le solde négatif n''est pas autorisé dans cette entreprise.';
  end if;

  -- Deux validations : le RH pré-valide, un administrateur décide ensuite
  if p_accepter and prive.mode_validation_absences(d.entreprise_id) = 'rh_puis_administrateur' and d.prevalidee_par is null then
    update public.demandes_absence set prevalidee_par = (select auth.uid()), prevalidee_le = now(),
           commentaire_decision = nullif(left(btrim(coalesce(p_commentaire, '')), 500), '')
     where id = d.id;
    return 'prevalidee';
  end if;

  update public.demandes_absence
     set statut = case when p_accepter then 'acceptee'::public.statut_demande else 'refusee'::public.statut_demande end,
         commentaire_decision = coalesce(nullif(left(btrim(coalesce(p_commentaire, '')), 500), ''), d.commentaire_decision),
         decide_par = (select auth.uid()), decide_le = now()
   where id = d.id;
  return case when p_accepter then 'acceptee' else 'refusee' end;
end
$$;
revoke all on function public.decider_demande(uuid, boolean, text) from public, anon;
grant execute on function public.decider_demande(uuid, boolean, text) to authenticated;

-- Demandes à traiter par la personne connectée
drop function public.mes_demandes_a_traiter();
create function public.mes_demandes_a_traiter()
returns table (demande_id uuid, entreprise_id uuid, raison_sociale text, salarie text, type_libelle text,
               debut date, fin date, nb_jours numeric, cree_le timestamptz, prevalidee boolean)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.entreprise_id, e.raison_sociale, s.nom || ' ' || s.prenoms, t.libelle, d.debut, d.fin, d.nb_jours, d.cree_le,
         d.prevalidee_par is not null
  from public.demandes_absence d
  join public.entreprises e on e.id = d.entreprise_id
  join public.salaries s on s.id = d.salarie_id
  join public.types_absence t on t.id = d.type_id
  where d.statut = 'en_attente' and prive.doit_traiter_demande(d)
  order by d.cree_le
$$;
revoke all on function public.mes_demandes_a_traiter() from public, anon;
grant execute on function public.mes_demandes_a_traiter() to authenticated;

-- Destinataires des alertes, selon le mode et l'étape (serveur uniquement)
create or replace function public.destinataires_demande_absence(p_demande_id uuid)
returns table (profil_id uuid, email text, whatsapp text, nom_complet text, entreprise_id uuid, raison_sociale text,
               salarie text, type_libelle text, debut date, fin date, nb_jours numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  d public.demandes_absence;
  v_admin_etape boolean;
begin
  select * into d from public.demandes_absence where id = p_demande_id;
  if not found or d.statut <> 'en_attente' then return; end if;
  v_admin_etape := prive.etape_administrateur(d);
  return query
    with rh as (
      select a.profil_id from public.affectations a where a.entreprise_id = d.entreprise_id and a.actif and a.role = 'rh'
    ),
    candidats as (
      select profil_id from rh where not v_admin_etape
      union
      select c.profil_id from prive.administrateurs_entreprise(d.entreprise_id) c(profil_id)
       where v_admin_etape or not exists (select 1 from rh)
    )
    select pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.id, e.raison_sociale, s.nom || ' ' || s.prenoms, t.libelle,
           d.debut, d.fin, d.nb_jours
    from candidats c
    join public.profils pr on pr.id = c.profil_id
    join public.entreprises e on e.id = d.entreprise_id
    join public.salaries s on s.id = d.salarie_id
    join public.types_absence t on t.id = d.type_id
    where pr.email is not null and pr.id is distinct from d.prevalidee_par;
end
$$;
revoke execute on function public.destinataires_demande_absence(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Demande du salarié : délai de prévenance et solde
-- ---------------------------------------------------------------------
create or replace function public.demander_absence(
  p_salarie_id uuid, p_type_id uuid, p_debut date, p_fin date,
  p_debut_apres_midi boolean, p_fin_midi boolean, p_motif text, p_justificatif text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.salaries;
  t public.types_absence;
  v_delai integer;
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
  -- Délai de prévenance : pour les congés décomptés du solde
  v_delai := coalesce((select c.delai_prevenance_jours from public.parametres_conges c where c.entreprise_id = s.entreprise_id), 0);
  if t.deduit_solde and v_delai > 0 and p_debut < current_date + v_delai then
    raise exception 'Les congés doivent être demandés au moins % jour(s) à l''avance.', v_delai;
  end if;
  v_jours := prive.jours_decomptes(s.entreprise_id, p_debut, p_fin, p_debut_apres_midi, p_fin_midi);
  if t.jours_max is not null and v_jours > t.jours_max then
    raise exception 'Ce type d''absence est limité à % jour(s).', t.jours_max;
  end if;
  if not prive.solde_suffisant(s.id, t.id, v_jours, true) then
    raise exception 'Solde de congés insuffisant pour cette demande.';
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

-- Saisie RH et confirmation de prévision : le solde négatif interdit s'applique aussi
create or replace function public.saisir_absence(
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
  if not prive.solde_suffisant(p_salarie_id, p_type_id,
       prive.jours_decomptes(v_entreprise, p_debut, p_fin, p_debut_apres_midi, p_fin_midi), false) then
    raise exception 'Solde de congés insuffisant : le solde négatif n''est pas autorisé dans cette entreprise.';
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

create or replace function public.confirmer_prevision(p_demande_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.demandes_absence;
begin
  select * into d from public.demandes_absence where id = p_demande_id for update;
  if not found or d.statut::text <> 'prevue' or not prive.peut_gerer_absences(d.entreprise_id) then
    raise exception 'Vous ne pouvez pas confirmer cette prévision.';
  end if;
  if not prive.solde_suffisant(d.salarie_id, d.type_id, d.nb_jours, false) then
    raise exception 'Solde de congés insuffisant : le solde négatif n''est pas autorisé dans cette entreprise.';
  end if;
  update public.demandes_absence
     set statut = 'acceptee', decide_par = (select auth.uid()), decide_le = now()
   where id = d.id;
end
$$;
