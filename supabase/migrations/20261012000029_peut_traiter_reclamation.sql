-- La personne connectée peut-elle répondre aux réclamations de ce sujet ? (affichage du formulaire)
create function public.peut_traiter_reclamation(p_entreprise_id uuid, p_sujet public.sujet_reclamation)
returns boolean
language sql stable security definer set search_path = ''
as $$ select prive.peut_traiter_reclamation(p_entreprise_id, p_sujet) $$;
revoke all on function public.peut_traiter_reclamation(uuid, public.sujet_reclamation) from public, anon;
grant execute on function public.peut_traiter_reclamation(uuid, public.sujet_reclamation) to authenticated;
