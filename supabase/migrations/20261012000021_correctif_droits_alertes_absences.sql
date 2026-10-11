-- Correctif : les coordonnées utilisées pour les alertes d'absence sont réservées
-- au serveur. Supabase accorde par défaut l'exécution aux utilisateurs connectés :
-- il faut donc aussi la retirer explicitement au rôle « authenticated ».
revoke execute on function public.destinataires_demande_absence(uuid), public.infos_decision_absence(uuid) from authenticated;
