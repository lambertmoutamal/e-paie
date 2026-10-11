-- Historique du circuit : heure exacte de chaque action (et non l'heure de début
-- de la transaction), pour toujours savoir quelle action est la plus récente.
alter table public.validations_periode alter column cree_le set default clock_timestamp();
