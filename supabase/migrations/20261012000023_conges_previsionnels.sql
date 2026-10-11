-- =====================================================================
-- Congés prévisionnels
-- =====================================================================
-- Le gestionnaire de paie (ou le RH, ou un administrateur) inscrit les dates de
-- congé prévues de chaque salarié. Une prévision n'est pas déduite du solde et ne
-- déclenche aucune alerte. Le RH (ou un administrateur) la confirme : elle devient
-- alors une absence acceptée.

create function prive.peut_prevoir_conges(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.peut_gerer_absences(p_entreprise_id)
    or (
      prive.a_role_entreprise(p_entreprise_id, array['gestionnaire_paie']::public.role_entreprise[])
      and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    )
$$;
revoke all on function prive.peut_prevoir_conges(uuid) from public;
grant execute on function prive.peut_prevoir_conges(uuid) to authenticated;

create function public.peut_prevoir_conges(p_entreprise_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.peut_prevoir_conges(p_entreprise_id) $$;

-- Les prévisions d'un même salarié ne se chevauchent pas entre elles ; elles
-- n'empêchent pas une vraie demande sur les mêmes dates.
create or replace function prive.verifier_demande_absence()
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
  if new.statut::text in ('en_attente', 'acceptee') and exists (
    select 1 from public.demandes_absence d
     where d.salarie_id = new.salarie_id and d.id <> new.id and d.statut::text in ('en_attente', 'acceptee')
       and daterange(d.debut, d.fin, '[]') && daterange(new.debut, new.fin, '[]')
  ) then
    raise exception 'Une autre absence existe déjà sur ces dates.';
  end if;
  if new.statut::text = 'prevue' and exists (
    select 1 from public.demandes_absence d
     where d.salarie_id = new.salarie_id and d.id <> new.id and d.statut::text = 'prevue'
       and daterange(d.debut, d.fin, '[]') && daterange(new.debut, new.fin, '[]')
  ) then
    raise exception 'Un congé est déjà prévu sur ces dates pour ce salarié.';
  end if;
  return new;
end
$$;

create function public.prevoir_conge(p_salarie_id uuid, p_type_id uuid, p_debut date, p_fin date, p_motif text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_entreprise uuid := (select s.entreprise_id from public.salaries s where s.id = p_salarie_id);
  v_id uuid;
begin
  if v_entreprise is null or not prive.peut_prevoir_conges(v_entreprise) then
    raise exception 'Vous ne pouvez pas prévoir de congé pour ce salarié.';
  end if;
  if not exists (select 1 from public.types_absence t where t.id = p_type_id and t.entreprise_id = v_entreprise and t.actif) then
    raise exception 'Ce type d''absence n''est pas disponible.';
  end if;
  insert into public.demandes_absence (entreprise_id, salarie_id, type_id, debut, fin, nb_jours, motif, statut, saisie_rh, cree_par)
  values (v_entreprise, p_salarie_id, p_type_id, p_debut, p_fin, 1, nullif(left(btrim(coalesce(p_motif, '')), 500), ''),
          'prevue', true, (select auth.uid()))
  returning id into v_id;
  return v_id;
end
$$;

create function public.supprimer_prevision(p_demande_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.demandes_absence d
   where d.id = p_demande_id and d.statut::text = 'prevue' and prive.peut_prevoir_conges(d.entreprise_id);
  if not found then raise exception 'Prévision introuvable ou suppression non autorisée.'; end if;
end
$$;

-- Confirmation par le RH ou un administrateur : la prévision devient une absence acceptée
create function public.confirmer_prevision(p_demande_id uuid)
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
  update public.demandes_absence
     set statut = 'acceptee', decide_par = (select auth.uid()), decide_le = now()
   where id = d.id;
end
$$;

revoke all on function
  public.peut_prevoir_conges(uuid),
  public.prevoir_conge(uuid, uuid, date, date, text),
  public.supprimer_prevision(uuid),
  public.confirmer_prevision(uuid)
from public, anon;
grant execute on function
  public.peut_prevoir_conges(uuid),
  public.prevoir_conge(uuid, uuid, date, date, text),
  public.supprimer_prevision(uuid),
  public.confirmer_prevision(uuid)
to authenticated;
