-- Correctif : le contrôle de rattachement lisait « contrat_parent_id » même pour la table
-- des documents (qui n'a pas ce champ). Le test est désormais imbriqué.
create or replace function prive.verifier_rattachement_salarie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.salaries s where s.id = new.salarie_id and s.entreprise_id = new.entreprise_id) then
    raise exception 'Le salarié n''appartient pas à cette entreprise.' using errcode = 'insufficient_privilege';
  end if;
  if tg_table_name = 'contrats' then
    if new.contrat_parent_id is not null and not exists (
      select 1 from public.contrats c where c.id = new.contrat_parent_id and c.salarie_id = new.salarie_id
    ) then
      raise exception 'Le contrat d''origine ne concerne pas ce salarié.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.entreprise_id <> old.entreprise_id or new.salarie_id <> old.salarie_id) then
    raise exception 'Le rattachement ne peut pas être modifié.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
