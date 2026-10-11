-- Congés prévisionnels : nouveau statut « prévue » (ajouté seul : une nouvelle valeur
-- d'énumération ne peut être utilisée qu'après l'enregistrement de cette migration).
alter type public.statut_demande add value if not exists 'prevue';
