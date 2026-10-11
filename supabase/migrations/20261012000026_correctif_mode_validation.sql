-- Correctif : la protection du mode de validation doit s'exécuter avec les droits de
-- la personne connectée (et non du propriétaire de la base) pour reconnaître un RH.
create or replace function prive.proteger_mode_validation()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.validation_absences is distinct from old.validation_absences
     and current_user = 'authenticated' and not prive.gere_entreprise(new.entreprise_id) then
    raise exception 'Seul un administrateur peut choisir qui valide les demandes.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
