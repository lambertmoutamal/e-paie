-- Règle de sécurité : aucune fonction n'est accessible à un visiteur non connecté.
-- La liste des cabinets du formulaire public est lue par le serveur (clé secrète).
drop function if exists public.cabinets_disponibles();
