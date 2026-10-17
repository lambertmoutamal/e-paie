-- Équipe du cabinet (décision du 2026-10-17)
--
--   * « Administrateur du cabinet » (table membres_cabinet) : gère le cabinet, son équipe et toutes
--     ses entreprises clientes. Un administrateur peut en ajouter ou en retirer d'autres.
--   * « Collaborateur » : employé du cabinet affecté à une ou plusieurs entreprises clientes avec
--     un rôle (table affectations). Il n'a aucun accès à la gestion du cabinet.
--
-- Garde-fou : un cabinet garde toujours au moins un administrateur. Un utilisateur connecté ne
-- peut pas retirer le dernier (l'administrateur plateforme et les outils serveur restent libres,
-- par exemple pour supprimer un cabinet entier).

create function prive.garder_un_admin_cabinet()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or prive.est_admin_plateforme() then
    return old;
  end if;
  -- Verrou sur le cabinet : deux retraits simultanés passent l'un après l'autre
  -- (sinon chacun verrait encore l'autre administrateur et le cabinet n'en aurait plus).
  perform 1 from public.cabinets c where c.id = old.cabinet_id for update;
  -- Seul compte un administrateur qui a activé son compte (pas une invitation en attente).
  if found and not exists (
       select 1 from public.membres_cabinet m
       join public.profils p on p.id = m.profil_id
       where m.cabinet_id = old.cabinet_id and m.profil_id <> old.profil_id and p.active_le is not null
     ) then
    raise exception 'Le cabinet doit garder au moins un administrateur.' using errcode = 'insufficient_privilege';
  end if;
  return old;
end
$$;
revoke all on function prive.garder_un_admin_cabinet() from public;
create trigger garder_un_admin before delete on public.membres_cabinet
  for each row execute function prive.garder_un_admin_cabinet();
