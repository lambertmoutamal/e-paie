-- Fiche salarié : numéro d'assuré CNAMGS (assurance maladie)
alter table public.salaries add column if not exists numero_cnamgs text;
