-- =====================================================================
-- Étape 4 ter : paiements en ligne (Mobile Money via Genuka Pay)
-- =====================================================================
-- Les paiements ne sont écrits que par le serveur (clé secrète), jamais
-- directement par un utilisateur. Un paiement réussi prolonge l'abonnement
-- une seule fois, même si la confirmation arrive plusieurs fois.

create type public.statut_paiement as enum ('initie', 'en_cours', 'reussi', 'echoue', 'expire', 'annule');

create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null references public.abonnements (id) on delete cascade,
  formule_id uuid not null references public.formules (id),
  duree_mois integer not null check (duree_mois in (1, 12)),
  montant numeric(12, 0) not null check (montant > 0),
  devise text not null,
  telephone text not null,
  prestataire text not null default 'genuka',
  reference_prestataire text,           -- identifiant de la transaction chez le prestataire
  suivi_prestataire text unique,        -- identifiant de suivi (track_id)
  statut public.statut_paiement not null default 'initie',
  frais numeric(12, 0),
  montant_net numeric(12, 0),
  periode_debut timestamptz,
  periode_fin timestamptz,
  erreur text,
  initie_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  confirme_le timestamptz
);
create index paiements_abonnement_idx on public.paiements (abonnement_id, cree_le desc);

-- Lecture : les administrateurs du titulaire de l'abonnement et l'admin plateforme.
revoke all on public.paiements from anon, authenticated;
grant select on public.paiements to authenticated;
alter table public.paiements enable row level security;

create policy paiements_lecture on public.paiements for select to authenticated
using (
  prive.est_admin_plateforme()
  or exists (
    select 1 from public.abonnements a
    where a.id = paiements.abonnement_id
      and (
        (a.cabinet_id is not null and prive.est_admin_cabinet(a.cabinet_id))
        or (a.entreprise_id is not null and prive.administre_entreprise(a.entreprise_id))
      )
  )
);

create trigger journaliser after insert or update or delete on public.paiements
  for each row execute function prive.journaliser('', '');

-- ---------------------------------------------------------------------
-- Application du résultat d'un paiement (serveur uniquement)
-- ---------------------------------------------------------------------
create function public.appliquer_paiement(
  p_paiement_id uuid,
  p_statut public.statut_paiement,
  p_reference text default null,
  p_frais numeric default null,
  p_montant_net numeric default null,
  p_erreur text default null
)
returns public.statut_paiement
language plpgsql security definer set search_path = ''
as $$
declare
  v_paiement public.paiements;
  v_abonnement public.abonnements;
  v_debut timestamptz;
  v_fin timestamptz;
begin
  -- Verrou : deux confirmations simultanées ne peuvent pas prolonger deux fois.
  select * into v_paiement from public.paiements where id = p_paiement_id for update;
  if not found then
    raise exception 'Paiement inconnu.';
  end if;

  -- Un paiement déjà terminé ne change plus.
  if v_paiement.statut in ('reussi', 'echoue', 'expire', 'annule') then
    return v_paiement.statut;
  end if;

  if p_statut = 'reussi' then
    select * into v_abonnement from public.abonnements where id = v_paiement.abonnement_id for update;
    -- La nouvelle période démarre à la fin de la période en cours si elle n'est pas
    -- terminée (aucun jour perdu), sinon aujourd'hui.
    v_debut := greatest(v_abonnement.fin, now());
    v_fin := v_debut + make_interval(months => v_paiement.duree_mois);

    update public.abonnements
    set statut = 'actif', formule_id = v_paiement.formule_id, fin = v_fin, demande_pro_le = null
    where id = v_abonnement.id;

    update public.paiements
    set statut = 'reussi', confirme_le = now(), periode_debut = v_debut, periode_fin = v_fin,
        reference_prestataire = coalesce(p_reference, reference_prestataire),
        frais = coalesce(p_frais, frais), montant_net = coalesce(p_montant_net, montant_net)
    where id = p_paiement_id;
  else
    update public.paiements
    set statut = p_statut,
        reference_prestataire = coalesce(p_reference, reference_prestataire),
        erreur = coalesce(p_erreur, erreur)
    where id = p_paiement_id;
  end if;

  return p_statut;
end
$$;

revoke all on function public.appliquer_paiement(uuid, public.statut_paiement, text, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function public.appliquer_paiement(uuid, public.statut_paiement, text, numeric, numeric, text)
  to service_role;
