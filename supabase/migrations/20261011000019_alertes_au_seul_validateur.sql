-- =====================================================================
-- Les alertes et actions « à faire » ne concernent que la personne qui doit agir
-- =====================================================================
-- Retrait du cas « sans validateur » (alerte aux administrateurs) : quand personne
-- ne peut valider une étape, seul l'avertissement de la page de la période l'indique.

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
begin
  select * into p from public.periodes_paie where id = p_periode_id;
  if not found then return; end if;
  select * into e from public.entreprises where id = p.entreprise_id;
  if not prive.ecriture_permise(prive.phase_entreprise(p.entreprise_id)) then return; end if;
  select * into v_derniere from prive.derniere_action_periode(p.id);

  if p.statut = 'en_validation' then
    return query
      select 'a_valider', pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.raison_sociale, e.id, p.annee, p.mois,
             p.circuit -> (p.etape_courante - 1) ->> 'libelle',
             case when v_derniere.action = 'refus' then v_derniere.commentaire end
      from prive.validateurs_possibles(p.id) c(profil_id)
      join public.profils pr on pr.id = c.profil_id
      where pr.email is not null;

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

create or replace function public.mes_actions_paie()
returns table (
  periode_id uuid, entreprise_id uuid, raison_sociale text, annee integer, mois integer,
  action text, libelle_etape text, depuis timestamptz, commentaire text
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.entreprise_id, e.raison_sociale, p.annee, p.mois,
         case p.statut when 'en_validation' then 'a_valider' when 'approuvee' then 'a_publier' else 'a_corriger' end,
         case p.statut
           when 'en_validation' then p.circuit -> (p.etape_courante - 1) ->> 'libelle'
           when 'approuvee' then 'Publication'
           else 'Correction'
         end,
         coalesce(d.cree_le, p.modifie_le),
         case when d.action = 'refus' then d.commentaire end
  from public.periodes_paie p
  join public.entreprises e on e.id = p.entreprise_id
  left join lateral prive.derniere_action_periode(p.id) d on true
  where p.statut in ('en_validation', 'approuvee', 'brouillon')
    and prive.a_acces_entreprise(p.entreprise_id)
    and (
      (p.statut = 'en_validation' and prive.motif_blocage_validation(p.id) is null)
      or (p.statut = 'approuvee' and prive.peut_publier(p.entreprise_id))
      or (p.statut = 'brouillon' and d.action = 'refus' and prive.peut_deposer_bulletins(p.entreprise_id))
    )
  order by coalesce(d.cree_le, p.modifie_le)
$$;
