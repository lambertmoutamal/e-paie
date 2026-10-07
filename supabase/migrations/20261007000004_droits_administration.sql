-- =====================================================================
-- Étape 4 : questions de droits posées par l'application
-- =====================================================================
-- Certaines actions (création d'un compte) utilisent la clé secrète, qui
-- contourne la RLS. Avant de s'en servir, l'application demande donc à la
-- base, au nom de la personne connectée, si elle en a le droit.
-- Ces fonctions ne renvoient que vrai/faux et ne concernent que l'appelant.

create function public.est_admin_plateforme()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.est_admin_plateforme() $$;

create function public.peut_gerer_cabinet(p_cabinet_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.est_admin_plateforme() or prive.est_admin_cabinet(p_cabinet_id) $$;

create function public.peut_gerer_entreprise(p_entreprise_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.gere_entreprise(p_entreprise_id) $$;

revoke all on function public.est_admin_plateforme() from public, anon;
revoke all on function public.peut_gerer_cabinet(uuid) from public, anon;
revoke all on function public.peut_gerer_entreprise(uuid) from public, anon;
grant execute on function public.est_admin_plateforme() to authenticated;
grant execute on function public.peut_gerer_cabinet(uuid) to authenticated;
grant execute on function public.peut_gerer_entreprise(uuid) to authenticated;
