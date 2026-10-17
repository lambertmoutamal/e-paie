-- Bulletins : version signée et chemins des fichiers verrouillés (audit de sécurité du 2026-10-17)
--
-- Faille corrigée :
--   * à l'insertion d'un bulletin, le déposant pouvait renseigner lui-même la « version signée »
--     (la protection ne jouait qu'à la modification) : le salarié recevait alors un autre fichier
--     que celui validé par le circuit ;
--   * le chemin du fichier n'était pas contrôlé : en y écrivant le chemin d'un bulletin d'une autre
--     entreprise, on pouvait le lire par le portail salarié ou le faire recopier par le serveur.
--
-- Désormais :
--   * à l'insertion, seules les colonnes du dépôt sont ouvertes à l'application ;
--   * la version signée ne peut être posée que par le serveur (clé secrète), à l'insertion comme à
--     la modification ;
--   * tout fichier d'un bulletin est rangé dans le dossier de son entreprise et de sa période :
--     <entreprise_id>/<periode_id>/... (version signée : <entreprise_id>/<periode_id>/signes/...) ;
--   * le salarié n'accède qu'aux fichiers rangés dans le dossier de l'entreprise du bulletin.

-- ---------------------------------------------------------------------
-- Insertion : colonnes du dépôt uniquement
-- ---------------------------------------------------------------------
revoke insert on public.bulletins from authenticated;
grant insert (entreprise_id, periode_id, salarie_id, type, remplace_bulletin_id,
              fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_par, depose_le)
  on public.bulletins to authenticated;

-- ---------------------------------------------------------------------
-- Version signée : écrite par le serveur uniquement, dès l'insertion
-- ---------------------------------------------------------------------
create or replace function prive.proteger_signature_bulletin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.fichier_signe_chemin is not null or new.empreinte_signee is not null or new.signe_le is not null then
      raise exception 'La version signée d''un bulletin ne peut pas être posée.' using errcode = 'insufficient_privilege';
    end if;
  elsif new.fichier_signe_chemin is distinct from old.fichier_signe_chemin
     or new.empreinte_signee is distinct from old.empreinte_signee
     or new.signe_le is distinct from old.signe_le then
    raise exception 'La version signée d''un bulletin ne peut pas être modifiée.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
drop trigger if exists proteger_signature on public.bulletins;
create trigger proteger_signature before insert or update on public.bulletins
  for each row execute function prive.proteger_signature_bulletin();

-- ---------------------------------------------------------------------
-- Chemins : dans le dossier de l'entreprise et de la période du bulletin (pour tout le monde,
-- serveur compris)
-- ---------------------------------------------------------------------
create function prive.verifier_chemins_bulletin()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_dossier text := new.entreprise_id::text || '/' || new.periode_id::text || '/';
begin
  if left(new.fichier_chemin, length(v_dossier)) <> v_dossier or position('..' in new.fichier_chemin) > 0 then
    raise exception 'Le fichier du bulletin doit être rangé dans le dossier de sa période.' using errcode = 'insufficient_privilege';
  end if;
  if new.fichier_signe_chemin is not null
     and (left(new.fichier_signe_chemin, length(v_dossier || 'signes/')) <> v_dossier || 'signes/'
          or position('..' in new.fichier_signe_chemin) > 0) then
    raise exception 'La version signée doit être rangée dans le dossier de sa période.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
revoke all on function prive.verifier_chemins_bulletin() from public;
create trigger bulletins_chemins before insert or update on public.bulletins
  for each row execute function prive.verifier_chemins_bulletin();

-- ---------------------------------------------------------------------
-- Portail salarié : seulement les fichiers du dossier de l'entreprise du bulletin
-- (défense en profondeur, en plus du contrôle des chemins ci-dessus)
-- ---------------------------------------------------------------------
create or replace function prive.est_mon_bulletin_publie(p_chemin text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bulletins b
    join public.periodes_paie p on p.id = b.periode_id
    where p_chemin in (b.fichier_chemin, b.fichier_signe_chemin)
      and left(p_chemin, length(b.entreprise_id::text || '/' || b.periode_id::text || '/'))
          = b.entreprise_id::text || '/' || b.periode_id::text || '/'
      and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
  )
$$;

create or replace function public.fichier_de_mon_bulletin(p_bulletin_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(b.fichier_signe_chemin, b.fichier_chemin)
  from public.bulletins b
  join public.periodes_paie p on p.id = b.periode_id
  where b.id = p_bulletin_id and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
    and left(coalesce(b.fichier_signe_chemin, b.fichier_chemin), length(b.entreprise_id::text || '/' || b.periode_id::text || '/'))
        = b.entreprise_id::text || '/' || b.periode_id::text || '/'
$$;
