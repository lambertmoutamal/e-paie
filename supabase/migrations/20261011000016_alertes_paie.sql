-- =====================================================================
-- Alertes de paie : qui doit agir, et liste des actions à faire
-- =====================================================================
-- Après chaque étape du circuit, le serveur prévient (email + WhatsApp) les
-- personnes qui peuvent agir. Le tableau de bord affiche les mêmes actions.

-- Numéro WhatsApp facultatif pour recevoir les alertes (modifiable par la personne elle-même)
alter table public.profils
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$');
grant update (whatsapp) on public.profils to authenticated;

-- Dernière action enregistrée dans l'historique d'une période (pour savoir si elle a été refusée)
create function prive.derniere_action_periode(p_periode_id uuid)
returns table (action text, commentaire text, cree_le timestamptz)
language sql stable security definer set search_path = ''
as $$
  select v.action, v.commentaire, v.cree_le
  from public.validations_periode v
  where v.periode_id = p_periode_id
  order by v.cree_le desc, v.etape asc
  limit 1
$$;
revoke all on function prive.derniere_action_periode(uuid) from public;
grant execute on function prive.derniere_action_periode(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Destinataires des alertes (serveur uniquement)
--   a_valider  : personnes pouvant valider l'étape en cours (mêmes règles que le circuit)
--   a_publier  : administrateurs et signataires, une fois la période approuvée
--   a_corriger : émetteur et gestionnaires de paie, après un refus qui ramène au brouillon
-- ---------------------------------------------------------------------
create function public.destinataires_alerte(p_periode_id uuid)
returns table (
  motif text, profil_id uuid, email text, whatsapp text, nom_complet text,
  raison_sociale text, entreprise_id uuid, annee integer, mois integer, libelle_etape text, commentaire text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  e public.entreprises;
  v_role text;
  v_derniere record;
begin
  select * into p from public.periodes_paie where id = p_periode_id;
  if not found then return; end if;
  select * into e from public.entreprises where id = p.entreprise_id;
  if not prive.ecriture_permise(prive.phase_entreprise(p.entreprise_id)) then return; end if;
  select * into v_derniere from prive.derniere_action_periode(p.id);

  if p.statut = 'en_validation' then
    v_role := p.circuit -> (p.etape_courante - 1) ->> 'role';
    return query
      with candidats as (
        select a.profil_id from public.affectations a
         where a.entreprise_id = p.entreprise_id and a.actif and v_role <> 'administrateur' and a.role::text = v_role
        union
        select a.profil_id from public.affectations a
         where a.entreprise_id = p.entreprise_id and a.actif and v_role = 'administrateur' and a.role = 'admin_entreprise'
        union
        select m.profil_id from public.membres_cabinet m
         where m.cabinet_id = e.cabinet_id and v_role = 'administrateur'
      )
      select 'a_valider', pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.raison_sociale, e.id, p.annee, p.mois,
             p.circuit -> (p.etape_courante - 1) ->> 'libelle',
             case when v_derniere.action = 'refus' then v_derniere.commentaire end
      from candidats c
      join public.profils pr on pr.id = c.profil_id
      where pr.email is not null
        and pr.id is distinct from p.soumis_par
        and not (pr.id = any (p.validateurs))
        and not exists (select 1 from public.bulletins b where b.periode_id = p.id and b.depose_par = pr.id);

  elsif p.statut = 'approuvee' then
    return query
      with candidats as (
        select a.profil_id from public.affectations a
         where a.entreprise_id = p.entreprise_id and a.actif and a.role in ('admin_entreprise', 'signataire')
        union
        select m.profil_id from public.membres_cabinet m where m.cabinet_id = e.cabinet_id
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
revoke all on function public.destinataires_alerte(uuid) from public, anon, authenticated;
grant execute on function public.destinataires_alerte(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Actions de paie qui attendent la personne connectée (tableau de bord, bandeau)
-- ---------------------------------------------------------------------
create function public.mes_actions_paie()
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
revoke all on function public.mes_actions_paie() from public, anon;
grant execute on function public.mes_actions_paie() to authenticated;
