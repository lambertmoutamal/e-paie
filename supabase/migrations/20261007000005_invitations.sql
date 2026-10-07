-- =====================================================================
-- Invitations par email (lien d'activation) et limite d'envoi d'emails
-- =====================================================================

-- 1. Date d'activation du compte : vide tant que la personne n'a pas cliqué
--    sur son lien d'invitation (affiché « Invitation en attente »).
alter table public.profils add column active_le timestamptz;

update public.profils p
set active_le = u.last_sign_in_at
from auth.users u
where u.id = p.id and u.last_sign_in_at is not null;

create function prive.marquer_compte_active()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profils
  set active_le = new.last_sign_in_at
  where id = new.id and active_le is null;
  return new;
end
$$;
revoke all on function prive.marquer_compte_active() from public;

create trigger marquer_compte_active
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is null and new.last_sign_in_at is not null)
  execute function prive.marquer_compte_active();

-- 2. L'indicateur « mot de passe à définir » remplace l'ancien « mot de passe provisoire »
--    (stocké dans app_metadata, modifiable uniquement par le serveur).
update auth.users
set raw_app_meta_data = (raw_app_meta_data - 'mot_de_passe_provisoire')
  || case when (raw_app_meta_data ->> 'mot_de_passe_provisoire')::boolean
          then jsonb_build_object('mot_de_passe_a_definir', true)
          else '{}'::jsonb end
where raw_app_meta_data ? 'mot_de_passe_provisoire';

-- 3. Limite d'envoi : empêche d'inonder une boîte mail (renvois d'invitation,
--    « mot de passe oublié » répété). Réservé au serveur (clé secrète).
create table prive.envois_email (
  cle text primary key,
  dernier_envoi timestamptz not null
);

create function public.reserver_envoi_email(p_cle text, p_delai_secondes integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_reserve boolean;
begin
  insert into prive.envois_email as e (cle, dernier_envoi)
  values (p_cle, now())
  on conflict (cle) do update
    set dernier_envoi = now()
    where e.dernier_envoi < now() - make_interval(secs => p_delai_secondes)
  returning true into v_reserve;
  return coalesce(v_reserve, false);
end
$$;

revoke all on function public.reserver_envoi_email(text, integer) from public, anon, authenticated;
grant execute on function public.reserver_envoi_email(text, integer) to service_role;
