-- Signature et cachet de l'employeur sur les bulletins
--   * l'entreprise dépose une image de signature et une image de cachet, et indique une fois
--     (sur un bulletin modèle) où se trouve la case « Émargement employeur » ;
--   * à la validation finale de la paie, chaque bulletin reçoit la signature et le cachet à cet
--     endroit. Le fichier d'origine est conservé ; la version signée est enregistrée à côté et
--     c'est elle que le salarié télécharge.

-- ---------------------------------------------------------------------
-- Réglages de l'entreprise
-- ---------------------------------------------------------------------
alter table public.entreprises
  add column if not exists signature_chemin text,
  add column if not exists cachet_chemin text,
  -- Case « Émargement employeur » en fractions de la page (0 à 1), depuis le coin haut gauche
  add column if not exists zone_emargement jsonb
    check (
      zone_emargement is null or (
        (zone_emargement ->> 'x')::numeric between 0 and 1 and (zone_emargement ->> 'y')::numeric between 0 and 1
        and (zone_emargement ->> 'largeur')::numeric between 0.02 and 1 and (zone_emargement ->> 'hauteur')::numeric between 0.01 and 1
      )
    );

-- ---------------------------------------------------------------------
-- Version signée de chaque bulletin (écrite par le serveur uniquement)
-- ---------------------------------------------------------------------
alter table public.bulletins
  add column if not exists fichier_signe_chemin text,
  add column if not exists empreinte_signee text,
  add column if not exists signe_le timestamptz;

-- Personne ne peut modifier ces colonnes depuis l'application (seul le serveur, avec la clé
-- secrète, appose la signature à la validation finale).
create function prive.proteger_signature_bulletin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (new.fichier_signe_chemin is distinct from old.fichier_signe_chemin
          or new.empreinte_signee is distinct from old.empreinte_signee
          or new.signe_le is distinct from old.signe_le) then
    raise exception 'La version signée d''un bulletin ne peut pas être modifiée.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger proteger_signature before update on public.bulletins
  for each row execute function prive.proteger_signature_bulletin();

-- ---------------------------------------------------------------------
-- Le salarié télécharge la version signée quand elle existe
-- ---------------------------------------------------------------------
create or replace function public.fichier_de_mon_bulletin(p_bulletin_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(b.fichier_signe_chemin, b.fichier_chemin)
  from public.bulletins b
  join public.periodes_paie p on p.id = b.periode_id
  where b.id = p_bulletin_id and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
$$;

create or replace function prive.est_mon_bulletin_publie(p_chemin text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bulletins b
    join public.periodes_paie p on p.id = b.periode_id
    where p_chemin in (b.fichier_chemin, b.fichier_signe_chemin)
      and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
  )
$$;

-- ---------------------------------------------------------------------
-- Images de signature et de cachet : espace privé, géré par le serveur
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
