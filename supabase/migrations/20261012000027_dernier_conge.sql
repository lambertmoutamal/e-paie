-- =====================================================================
-- Date du dernier congé de chaque salarié
-- =====================================================================
-- Calculée à partir des congés payés acceptés dans DématPaie ; à défaut, dates
-- saisies par le RH avec le solde de départ (congés pris avant DématPaie).

alter table public.soldes_conges_initiaux
  add column dernier_conge_debut date,
  add column dernier_conge_fin date,
  add constraint soldes_initiaux_dernier_conge_check
    check (dernier_conge_fin is null or (dernier_conge_debut is not null and dernier_conge_fin >= dernier_conge_debut));

drop function public.definir_solde_initial(uuid, date, numeric);
create function public.definir_solde_initial(
  p_salarie_id uuid, p_date_reference date, p_jours numeric,
  p_dernier_debut date default null, p_dernier_fin date default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_entreprise uuid := (select s.entreprise_id from public.salaries s where s.id = p_salarie_id);
begin
  if v_entreprise is null or not prive.peut_gerer_absences(v_entreprise) then
    raise exception 'Vous ne pouvez pas modifier ce solde.';
  end if;
  insert into public.soldes_conges_initiaux (salarie_id, entreprise_id, date_reference, jours, dernier_conge_debut, dernier_conge_fin, saisi_par)
  values (p_salarie_id, v_entreprise, p_date_reference, p_jours, p_dernier_debut, coalesce(p_dernier_fin, p_dernier_debut), (select auth.uid()))
  on conflict (salarie_id) do update
    set date_reference = excluded.date_reference, jours = excluded.jours,
        dernier_conge_debut = excluded.dernier_conge_debut, dernier_conge_fin = excluded.dernier_conge_fin,
        saisi_par = excluded.saisi_par, modifie_le = now();
end
$$;
revoke all on function public.definir_solde_initial(uuid, date, numeric, date, date) from public, anon;
grant execute on function public.definir_solde_initial(uuid, date, numeric, date, date) to authenticated;

-- Dernier congé payé (commencé) : enregistré dans DématPaie, sinon saisi par le RH
create function prive.dernier_conge(p_salarie_id uuid)
returns table (debut date, fin date, source text)
language sql stable security definer set search_path = ''
as $$
  select x.debut, x.fin, x.source from (
    select d.debut, d.fin, 'dematpaie'::text as source, 1 as priorite
      from public.demandes_absence d join public.types_absence t on t.id = d.type_id
     where d.salarie_id = p_salarie_id and d.statut = 'acceptee' and t.nature = 'conge' and d.debut <= current_date
    union all
    select i.dernier_conge_debut, i.dernier_conge_fin, 'saisie', 2
      from public.soldes_conges_initiaux i
     where i.salarie_id = p_salarie_id and i.dernier_conge_debut is not null
  ) x
  order by x.priorite, x.debut desc
  limit 1
$$;
revoke all on function prive.dernier_conge(uuid) from public;

create function public.derniers_conges_entreprise(p_entreprise_id uuid)
returns table (salarie_id uuid, debut date, fin date, source text)
language sql stable security definer set search_path = ''
as $$
  select s.id, c.debut, c.fin, c.source
  from public.salaries s, lateral prive.dernier_conge(s.id) c
  where s.entreprise_id = p_entreprise_id and prive.a_acces_entreprise(p_entreprise_id)
$$;

create function public.mon_dernier_conge(p_salarie_id uuid)
returns table (debut date, fin date, source text)
language sql stable security definer set search_path = ''
as $$ select c.* from prive.dernier_conge(p_salarie_id) c where prive.est_mon_salarie(p_salarie_id) $$;

revoke all on function public.derniers_conges_entreprise(uuid), public.mon_dernier_conge(uuid) from public, anon;
grant execute on function public.derniers_conges_entreprise(uuid), public.mon_dernier_conge(uuid) to authenticated;
