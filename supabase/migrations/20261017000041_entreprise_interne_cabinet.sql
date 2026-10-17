-- « Mon cabinet » : le cabinet fait la paie de ses propres employés (décision du 2026-10-17)
--
-- Chaque cabinet peut avoir une entreprise interne qui le représente comme employeur. Elle se
-- gère exactement comme une entreprise cliente (salariés, contrats, bulletins, portail), avec
-- les mêmes droits et la même isolation, et dépend de l'abonnement du cabinet.
--   * au plus une entreprise interne par cabinet ;
--   * une entreprise interne est toujours rattachée à un cabinet ;
--   * le marquage est posé à la création et ne change plus ensuite.

alter table public.entreprises
  add column if not exists interne_cabinet boolean not null default false;

alter table public.entreprises
  add constraint entreprises_interne_avec_cabinet check (not interne_cabinet or cabinet_id is not null);

create unique index if not exists entreprises_une_interne_par_cabinet
  on public.entreprises (cabinet_id) where interne_cabinet;

create function prive.figer_entreprise_interne()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.interne_cabinet is distinct from old.interne_cabinet then
    raise exception 'Le caractère « Mon cabinet » d''une entreprise ne peut pas être modifié.' using errcode = 'insufficient_privilege';
  end if;
  if old.interne_cabinet and new.cabinet_id is distinct from old.cabinet_id then
    raise exception 'L''entreprise interne d''un cabinet ne peut pas changer de cabinet.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
revoke all on function prive.figer_entreprise_interne() from public;
create trigger figer_interne before update on public.entreprises
  for each row execute function prive.figer_entreprise_interne();
