-- Filet de sécurité : toute table est tracée dans le journal d'audit, y compris les avis envoyés.
create trigger journaliser after insert or update or delete on public.avis_bulletins
  for each row execute function prive.journaliser('entreprise_id', '');
