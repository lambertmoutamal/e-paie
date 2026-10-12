-- =====================================================================
-- Étape 11 : réclamations des salariés
-- =====================================================================
-- Le salarié ouvre une réclamation depuis son portail et échange avec l'entreprise.
-- Traitement selon le sujet : bulletin → gestionnaire de paie ; autres sujets → RH ;
-- sans personne ayant ce rôle → administrateurs. Chacun ne voit que ce qui le concerne.
-- Toutes les écritures passent par des fonctions.

create type public.sujet_reclamation as enum ('bulletin', 'conges', 'contrat', 'attestation', 'autre');
create type public.statut_reclamation as enum ('ouverte', 'en_cours', 'resolue', 'fermee');

create table public.reclamations (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete cascade,
  sujet public.sujet_reclamation not null,
  objet text not null check (char_length(btrim(objet)) between 3 and 120),
  bulletin_id uuid references public.bulletins (id) on delete set null,
  statut public.statut_reclamation not null default 'ouverte',
  pris_en_charge_par uuid references public.profils (id) on delete set null,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default clock_timestamp(),
  derniere_activite timestamptz not null default clock_timestamp(),
  attente_personnel boolean not null default true,     -- le dernier message vient du salarié
  resolue_le timestamptz
);
create index reclamations_entreprise_idx on public.reclamations (entreprise_id, statut, derniere_activite desc);
create index reclamations_salarie_idx on public.reclamations (salarie_id, derniere_activite desc);

create table public.messages_reclamation (
  id uuid primary key default gen_random_uuid(),
  reclamation_id uuid not null references public.reclamations (id) on delete cascade,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  auteur uuid references public.profils (id) on delete set null,
  de_salarie boolean not null,
  contenu text not null check (char_length(btrim(contenu)) between 1 and 3000),
  piece_chemin text,
  piece_nom text,
  cree_le timestamptz not null default clock_timestamp()
);
create index messages_reclamation_idx on public.messages_reclamation (reclamation_id, cree_le);

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------
-- Rôle chargé d'un sujet
create function prive.role_traitant(p_sujet public.sujet_reclamation)
returns public.role_entreprise
language sql immutable set search_path = ''
as $$ select case when p_sujet = 'bulletin' then 'gestionnaire_paie'::public.role_entreprise else 'rh'::public.role_entreprise end $$;

-- Voir une réclamation : administrateurs, ou personne ayant le rôle chargé de ce sujet
create function prive.peut_voir_reclamation(p_entreprise_id uuid, p_sujet public.sujet_reclamation)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.phase_entreprise(p_entreprise_id) <> 'bloque'
    and (prive.administre_entreprise(p_entreprise_id) or prive.a_role_entreprise(p_entreprise_id, array[prive.role_traitant(p_sujet)]))
$$;

-- Répondre : mêmes personnes, abonnement actif
create function prive.peut_traiter_reclamation(p_entreprise_id uuid, p_sujet public.sujet_reclamation)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.peut_voir_reclamation(p_entreprise_id, p_sujet) and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
$$;

-- Doit-elle apparaître dans « À faire » de la personne connectée ? (rôle chargé ; sinon administrateurs)
create function prive.doit_traiter_reclamation(r public.reclamations)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select r.statut in ('ouverte', 'en_cours') and r.attente_personnel
    and prive.ecriture_permise(prive.phase_entreprise(r.entreprise_id))
    and (
      prive.a_role_entreprise(r.entreprise_id, array[prive.role_traitant(r.sujet)])
      or (
        not exists (select 1 from public.affectations a where a.entreprise_id = r.entreprise_id and a.actif and a.role = prive.role_traitant(r.sujet))
        and prive.administre_entreprise(r.entreprise_id) and not prive.est_admin_plateforme()
      )
    )
$$;

revoke all on function prive.role_traitant(public.sujet_reclamation), prive.peut_voir_reclamation(uuid, public.sujet_reclamation),
  prive.peut_traiter_reclamation(uuid, public.sujet_reclamation), prive.doit_traiter_reclamation(public.reclamations) from public;
grant execute on function prive.role_traitant(public.sujet_reclamation), prive.peut_voir_reclamation(uuid, public.sujet_reclamation)
  to authenticated;

alter table public.reclamations enable row level security;
alter table public.messages_reclamation enable row level security;
revoke all on public.reclamations, public.messages_reclamation from anon, authenticated;
grant select on public.reclamations, public.messages_reclamation to authenticated;

create policy reclamations_lecture on public.reclamations for select to authenticated
using (prive.peut_voir_reclamation(entreprise_id, sujet));
create policy messages_reclamation_lecture on public.messages_reclamation for select to authenticated
using (exists (select 1 from public.reclamations r where r.id = reclamation_id and prive.peut_voir_reclamation(r.entreprise_id, r.sujet)));

create trigger journaliser after insert or update or delete on public.reclamations
  for each row execute function prive.journaliser('entreprise_id', '');
create trigger journaliser after insert or update or delete on public.messages_reclamation
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Pièces jointes : espace privé « reclamations » (PDF, JPEG, PNG ; 5 Mo)
-- Chemin : <entreprise_id>/<salarie_id>/<identifiant>.<extension>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamations', 'reclamations', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Le fichier est-il joint à une réclamation visible par la personne connectée ?
create function prive.piece_reclamation_visible(p_chemin text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.messages_reclamation m join public.reclamations r on r.id = m.reclamation_id
    where m.piece_chemin = p_chemin
      and (prive.peut_voir_reclamation(r.entreprise_id, r.sujet) or prive.est_mon_salarie(r.salarie_id))
  )
$$;
-- Dépôt par le personnel : gestionnaire de paie, RH ou administrateur de l'entreprise
create function prive.peut_deposer_piece_reclamation(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    and (prive.administre_entreprise(p_entreprise_id)
         or prive.a_role_entreprise(p_entreprise_id, array['gestionnaire_paie', 'rh']::public.role_entreprise[]))
$$;
revoke all on function prive.piece_reclamation_visible(text), prive.peut_deposer_piece_reclamation(uuid) from public;
grant execute on function prive.piece_reclamation_visible(text), prive.peut_deposer_piece_reclamation(uuid) to authenticated;

create policy reclamations_fichiers_lecture on storage.objects for select to authenticated
using (bucket_id = 'reclamations' and (prive.piece_reclamation_visible(name) or prive.fichier_absence_a_moi(name)));
create policy reclamations_fichiers_depot on storage.objects for insert to authenticated
with check (bucket_id = 'reclamations' and (prive.peut_deposer_piece_reclamation(prive.entreprise_du_fichier(name)) or prive.fichier_absence_a_moi(name)));

-- ---------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------
-- Une pièce jointe doit être rangée dans le dossier du salarié concerné
create function prive.piece_valide(p_chemin text, p_entreprise_id uuid, p_salarie_id uuid)
returns boolean
language sql immutable set search_path = ''
as $$ select p_chemin is null or (split_part(p_chemin, '/', 1) = p_entreprise_id::text and split_part(p_chemin, '/', 2) = p_salarie_id::text) $$;
revoke all on function prive.piece_valide(text, uuid, uuid) from public;

-- Le salarié ouvre une réclamation
create function public.ouvrir_reclamation(
  p_salarie_id uuid, p_sujet public.sujet_reclamation, p_objet text, p_message text,
  p_bulletin_id uuid default null, p_piece_chemin text default null, p_piece_nom text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.salaries;
  v_id uuid;
begin
  select * into s from public.salaries where id = p_salarie_id;
  if not found or not prive.est_mon_salarie(s.id) then raise exception 'Réclamation impossible.'; end if;
  if not prive.ecriture_permise(prive.phase_entreprise(s.entreprise_id)) then
    raise exception 'Les réclamations sont suspendues pour le moment. Contactez votre service RH.';
  end if;
  -- Bulletin rattaché : un de SES bulletins publiés
  if p_bulletin_id is not null and not exists (
    select 1 from public.bulletins b join public.periodes_paie p on p.id = b.periode_id
     where b.id = p_bulletin_id and b.salarie_id = s.id and p.statut = 'publiee'
  ) then
    raise exception 'Bulletin introuvable.';
  end if;
  if not prive.piece_valide(p_piece_chemin, s.entreprise_id, s.id) then raise exception 'Pièce jointe invalide.'; end if;

  insert into public.reclamations (entreprise_id, salarie_id, sujet, objet, bulletin_id, cree_par)
  values (s.entreprise_id, s.id, p_sujet, btrim(p_objet), p_bulletin_id, (select auth.uid()))
  returning id into v_id;
  insert into public.messages_reclamation (reclamation_id, entreprise_id, auteur, de_salarie, contenu, piece_chemin, piece_nom)
  values (v_id, s.entreprise_id, (select auth.uid()), true, btrim(p_message), p_piece_chemin, left(p_piece_nom, 200));
  return v_id;
end
$$;

-- Nouveau message, du salarié ou du personnel. Le personnel peut marquer la réclamation
-- « résolue » ; le salarié qui répond sur une réclamation résolue la rouvre.
create function public.ajouter_message_reclamation(
  p_reclamation_id uuid, p_contenu text, p_piece_chemin text default null, p_piece_nom text default null,
  p_resoudre boolean default false
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reclamations;
  v_salarie boolean;
  v_statut public.statut_reclamation;
begin
  select * into r from public.reclamations where id = p_reclamation_id for update;
  if not found then raise exception 'Réclamation introuvable.'; end if;
  v_salarie := prive.est_mon_salarie(r.salarie_id);
  if not v_salarie and not prive.peut_traiter_reclamation(r.entreprise_id, r.sujet) then
    raise exception 'Vous ne pouvez pas répondre à cette réclamation.';
  end if;
  if r.statut = 'fermee' then raise exception 'Cette réclamation est close.'; end if;
  if not prive.piece_valide(p_piece_chemin, r.entreprise_id, r.salarie_id) then raise exception 'Pièce jointe invalide.'; end if;
  if p_resoudre and v_salarie then raise exception 'Seule l''entreprise peut marquer la réclamation comme résolue.'; end if;

  insert into public.messages_reclamation (reclamation_id, entreprise_id, auteur, de_salarie, contenu, piece_chemin, piece_nom)
  values (r.id, r.entreprise_id, (select auth.uid()), v_salarie, btrim(p_contenu), p_piece_chemin, left(p_piece_nom, 200));

  v_statut := case when p_resoudre then 'resolue'::public.statut_reclamation else 'en_cours'::public.statut_reclamation end;
  update public.reclamations
     set statut = v_statut,
         attente_personnel = v_salarie,
         derniere_activite = clock_timestamp(),
         resolue_le = case when p_resoudre then now() else null end,
         pris_en_charge_par = case when v_salarie then pris_en_charge_par else coalesce(pris_en_charge_par, (select auth.uid())) end
   where id = r.id;
  return v_statut::text;
end
$$;

-- Le salarié confirme que tout est réglé : la réclamation est close
create function public.cloturer_ma_reclamation(p_reclamation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.reclamations set statut = 'fermee', attente_personnel = false, derniere_activite = clock_timestamp()
   where id = p_reclamation_id and statut = 'resolue' and prive.est_mon_salarie(salarie_id);
  if not found then raise exception 'Seule une réclamation résolue peut être close.'; end if;
end
$$;

-- Portail : réclamations et messages du salarié connecté
create function public.mes_reclamations()
returns table (id uuid, salarie_id uuid, raison_sociale text, sujet text, objet text, statut text,
               cree_le timestamptz, derniere_activite timestamptz, attente_personnel boolean)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.salarie_id, e.raison_sociale, r.sujet::text, r.objet, r.statut::text, r.cree_le, r.derniere_activite, r.attente_personnel
  from public.reclamations r join public.entreprises e on e.id = r.entreprise_id
  where prive.est_mon_salarie(r.salarie_id)
  order by r.derniere_activite desc
$$;

create function public.messages_de_ma_reclamation(p_reclamation_id uuid)
returns table (id uuid, de_salarie boolean, auteur text, contenu text, piece_chemin text, piece_nom text, cree_le timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.de_salarie,
         case when m.de_salarie then 'Vous' else coalesce(nullif(p.nom_complet, ''), 'Votre employeur') end,
         m.contenu, m.piece_chemin, m.piece_nom, m.cree_le
  from public.messages_reclamation m
  join public.reclamations r on r.id = m.reclamation_id
  left join public.profils p on p.id = m.auteur
  where r.id = p_reclamation_id and prive.est_mon_salarie(r.salarie_id)
  order by m.cree_le
$$;

-- Personnel : réclamations qui attendent une réponse de la personne connectée
create function public.mes_reclamations_a_traiter()
returns table (reclamation_id uuid, entreprise_id uuid, raison_sociale text, salarie text, sujet text, objet text, derniere_activite timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.entreprise_id, e.raison_sociale, s.nom || ' ' || s.prenoms, r.sujet::text, r.objet, r.derniere_activite
  from public.reclamations r
  join public.entreprises e on e.id = r.entreprise_id
  join public.salaries s on s.id = r.salarie_id
  where prive.doit_traiter_reclamation(r)
  order by r.derniere_activite
$$;

-- Alertes (serveur uniquement) : personnes chargées du sujet (sinon administrateurs)
create function public.destinataires_reclamation(p_reclamation_id uuid)
returns table (profil_id uuid, email text, whatsapp text, nom_complet text, entreprise_id uuid, raison_sociale text,
               salarie text, sujet text, objet text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.reclamations;
begin
  select * into r from public.reclamations where id = p_reclamation_id;
  if not found or not r.attente_personnel or r.statut not in ('ouverte', 'en_cours') then return; end if;
  return query
    with charges as (
      select a.profil_id from public.affectations a
       where a.entreprise_id = r.entreprise_id and a.actif and a.role = prive.role_traitant(r.sujet)
    ),
    candidats as (
      select profil_id from charges
      union
      select c.profil_id from prive.administrateurs_entreprise(r.entreprise_id) c(profil_id) where not exists (select 1 from charges)
    )
    select pr.id, pr.email, pr.whatsapp, pr.nom_complet, e.id, e.raison_sociale, s.nom || ' ' || s.prenoms, r.sujet::text, r.objet
    from candidats c
    join public.profils pr on pr.id = c.profil_id
    join public.entreprises e on e.id = r.entreprise_id
    join public.salaries s on s.id = r.salarie_id
    where pr.email is not null;
end
$$;

-- Coordonnées du salarié pour l'informer d'une réponse (serveur uniquement)
create function public.infos_reponse_reclamation(p_reclamation_id uuid)
returns table (prenoms text, telephone text, email text, raison_sociale text, objet text, statut text)
language sql stable security definer set search_path = ''
as $$
  select s.prenoms, s.telephone, s.email, e.raison_sociale, r.objet, r.statut::text
  from public.reclamations r
  join public.salaries s on s.id = r.salarie_id
  join public.entreprises e on e.id = r.entreprise_id
  where r.id = p_reclamation_id
$$;

revoke all on function
  public.ouvrir_reclamation(uuid, public.sujet_reclamation, text, text, uuid, text, text),
  public.ajouter_message_reclamation(uuid, text, text, text, boolean),
  public.cloturer_ma_reclamation(uuid),
  public.mes_reclamations(),
  public.messages_de_ma_reclamation(uuid),
  public.mes_reclamations_a_traiter(),
  public.destinataires_reclamation(uuid),
  public.infos_reponse_reclamation(uuid)
from public, anon, authenticated;
grant execute on function
  public.ouvrir_reclamation(uuid, public.sujet_reclamation, text, text, uuid, text, text),
  public.ajouter_message_reclamation(uuid, text, text, text, boolean),
  public.cloturer_ma_reclamation(uuid),
  public.mes_reclamations(),
  public.messages_de_ma_reclamation(uuid),
  public.mes_reclamations_a_traiter()
to authenticated;
grant execute on function public.destinataires_reclamation(uuid), public.infos_reponse_reclamation(uuid) to service_role;
