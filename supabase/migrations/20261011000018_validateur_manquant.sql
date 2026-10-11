-- =====================================================================
-- Étape sans validateur possible : on prévient les administrateurs
-- =====================================================================
-- Exemple : l'étape « Approbation » demande un signataire, mais personne n'a ce
-- rôle dans l'entreprise. Sans cela, la période resterait bloquée en silence.

-- Personnes pouvant valider l'étape en cours (mêmes règles que le circuit)
create function prive.validateurs_possibles(p_periode_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  with p as (
    select pp.*, e.cabinet_id, pp.circuit -> (pp.etape_courante - 1) ->> 'role' as role_etape
    from public.periodes_paie pp join public.entreprises e on e.id = pp.entreprise_id
    where pp.id = p_periode_id and pp.statut = 'en_validation'
  ),
  candidats as (
    select a.profil_id from p join public.affectations a
      on a.entreprise_id = p.entreprise_id and a.actif and p.role_etape <> 'administrateur' and a.role::text = p.role_etape
    union
    select a.profil_id from p join public.affectations a
      on a.entreprise_id = p.entreprise_id and a.actif and p.role_etape = 'administrateur' and a.role = 'admin_entreprise'
    union
    select m.profil_id from p join public.membres_cabinet m
      on m.cabinet_id = p.cabinet_id and p.role_etape = 'administrateur'
  )
  select c.profil_id from candidats c, p
  where c.profil_id is distinct from p.soumis_par
    and not (c.profil_id = any (p.validateurs))
    and not exists (select 1 from public.bulletins b where b.periode_id = p.id and b.depose_par = c.profil_id)
$$;
revoke all on function prive.validateurs_possibles(uuid) from public;
grant execute on function prive.validateurs_possibles(uuid) to authenticated;

-- Nombre de validateurs possibles (affiché sur la page de la période)
create function public.nb_validateurs_possibles(p_periode_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select case when prive.a_acces_entreprise(pp.entreprise_id)
              then (select count(*)::integer from prive.validateurs_possibles(pp.id)) end
  from public.periodes_paie pp where pp.id = p_periode_id
$$;
revoke all on function public.nb_validateurs_possibles(uuid) from public, anon;
grant execute on function public.nb_validateurs_possibles(uuid) to authenticated;

-- Administrateurs d'une entreprise (cabinet ou administrateur de l'entreprise)
create function prive.administrateurs_entreprise(p_entreprise_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.profil_id from public.affectations a
   where a.entreprise_id = p_entreprise_id and a.actif and a.role = 'admin_entreprise'
  union
  select m.profil_id from public.membres_cabinet m
   join public.entreprises e on e.cabinet_id = m.cabinet_id
   where e.id = p_entreprise_id
$$;
revoke all on function prive.administrateurs_entreprise(uuid) from public;

-- ---------------------------------------------------------------------
-- Destinataires : mêmes cas qu'avant, plus « sans_validateur »
-- ---------------------------------------------------------------------
create or replace function public.destinataires_alerte(p_periode_id uuid)
returns table (
  motif text, profil_id uuid, email text, whatsapp text, nom_complet text,
  raison_sociale text, entreprise_id uuid, annee integer, mois integer, libelle_etape text, commentaire text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  e public.entreprises;
  v_derniere record;
  v_libelle text;
begin
  select * into p from public.periodes_paie where id = p_periode_id;
  if not found then return; end if;
  select * into e from public.entreprises where id = p.entreprise_id;
  if not prive.ecriture_permise(prive.phase_entreprise(p.entreprise_id)) then return; end if;
  select * into v_derniere from prive.derniere_action_periode(p.id);

  if p.statut = 'en_validation' then
    v_libelle := p.circuit -> (p.etape_courante - 1) ->> 'libelle';
    if exists (select 1 from prive.validateurs_possibles(p.id)) then
      return query
        select 'a_valider', pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.raison_sociale, e.id, p.annee, p.mois,
               v_libelle, case when v_derniere.action = 'refus' then v_derniere.commentaire end
        from prive.validateurs_possibles(p.id) c(profil_id)
        join public.profils pr on pr.id = c.profil_id
        where pr.email is not null;
    else
      -- Personne ne peut valider : les administrateurs doivent attribuer le rôle
      return query
        select 'sans_validateur', pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.raison_sociale, e.id, p.annee, p.mois,
               v_libelle, (p.circuit -> (p.etape_courante - 1) ->> 'role')
        from prive.administrateurs_entreprise(p.entreprise_id) c(profil_id)
        join public.profils pr on pr.id = c.profil_id
        where pr.email is not null;
    end if;

  elsif p.statut = 'approuvee' then
    return query
      with candidats as (
        select a.profil_id from public.affectations a
         where a.entreprise_id = p.entreprise_id and a.actif and a.role = 'signataire'
        union
        select c.profil_id from prive.administrateurs_entreprise(p.entreprise_id) c(profil_id)
      )
      select 'a_publier', pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.raison_sociale, e.id, p.annee, p.mois,
             'Publication'::text, null::text
      from candidats c join public.profils pr on pr.id = c.profil_id
      where pr.email is not null;

  elsif p.statut = 'brouillon' and v_derniere.action = 'refus' then
    return query
      with candidats as (
        select p.soumis_par as profil_id where p.soumis_par is not null
        union
        select a.profil_id from public.affectations a
         where a.entreprise_id = p.entreprise_id and a.actif and a.role = 'gestionnaire_paie'
      )
      select 'a_corriger', pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.raison_sociale, e.id, p.annee, p.mois,
             'Correction'::text, v_derniere.commentaire
      from candidats c join public.profils pr on pr.id = c.profil_id
      where pr.email is not null;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Actions à faire : ajout de « sans_validateur » pour les administrateurs
-- ---------------------------------------------------------------------
create or replace function public.mes_actions_paie()
returns table (
  periode_id uuid, entreprise_id uuid, raison_sociale text, annee integer, mois integer,
  action text, libelle_etape text, depuis timestamptz, commentaire text
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.entreprise_id, e.raison_sociale, p.annee, p.mois,
         case
           when p.statut = 'en_validation' and prive.motif_blocage_validation(p.id) is null then 'a_valider'
           when p.statut = 'en_validation' then 'sans_validateur'
           when p.statut = 'approuvee' then 'a_publier'
           else 'a_corriger'
         end,
         case p.statut
           when 'en_validation' then p.circuit -> (p.etape_courante - 1) ->> 'libelle'
           when 'approuvee' then 'Publication'
           else 'Correction'
         end,
         coalesce(d.cree_le, p.modifie_le),
         case
           when d.action = 'refus' then d.commentaire
           when p.statut = 'en_validation' and prive.motif_blocage_validation(p.id) is not null
             then p.circuit -> (p.etape_courante - 1) ->> 'role'
         end
  from public.periodes_paie p
  join public.entreprises e on e.id = p.entreprise_id
  left join lateral prive.derniere_action_periode(p.id) d on true
  where p.statut in ('en_validation', 'approuvee', 'brouillon')
    and prive.a_acces_entreprise(p.entreprise_id)
    and (
      (p.statut = 'en_validation' and prive.motif_blocage_validation(p.id) is null)
      or (p.statut = 'en_validation' and prive.gere_entreprise(p.entreprise_id)
          and not exists (select 1 from prive.validateurs_possibles(p.id)))
      or (p.statut = 'approuvee' and prive.peut_publier(p.entreprise_id))
      or (p.statut = 'brouillon' and d.action = 'refus' and prive.peut_deposer_bulletins(p.entreprise_id))
    )
  order by coalesce(d.cree_le, p.modifie_le)
$$;
