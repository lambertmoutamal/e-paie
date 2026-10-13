-- Fiche salarié : mode de paiement du salaire et localisation (lieu de travail),
-- renseignés à la main, par l'import Excel ou lus sur le bulletin de paie.
alter table public.salaries
  add column if not exists mode_paiement text
    check (mode_paiement is null or mode_paiement in ('virement', 'especes', 'cheque', 'mobile_money')),
  add column if not exists localisation text;
