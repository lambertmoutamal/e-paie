-- =====================================================================
-- Étape 9 : publication des bulletins et portail salarié
-- =====================================================================
-- Le salarié se connecte avec son téléphone (code SMS ou WhatsApp, Twilio Verify
-- configuré dans Supabase). Son compte est rattaché aux fiches salarié portant ce
-- numéro. Il ne lit jamais les tables directement : deux fonctions lui renvoient
-- ses emplois et ses bulletins publiés ; le stockage ne lui ouvre que ces fichiers.
-- Abonnement bloqué : plus aucun accès, salariés compris.

-- ---------------------------------------------------------------------
-- Rattachement fiche salarié ↔ compte du salarié
-- ---------------------------------------------------------------------
-- La colonne salaries.profil_id existe depuis l'étape 5 (prévue pour ce portail).
create index salaries_profil_idx on public.salaries (profil_id) where profil_id is not null;

-- Seul le serveur (rôle service) rattache un compte. Changer le numéro détache
-- l'ancien compte : le bulletin suit le numéro saisi par l'employeur.
create function prive.proteger_rattachement_salarie()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' then new.profil_id := null; end if;
    return new;
  end if;
  if new.telephone is distinct from old.telephone then
    new.profil_id := null;
  elsif new.profil_id is distinct from old.profil_id and current_user = 'authenticated' then
    raise exception 'Le compte du salarié ne peut pas être modifié.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger salaries_rattachement before insert or update on public.salaries
  for each row execute function prive.proteger_rattachement_salarie();

-- Le numéro correspond-il à un salarié pouvant accéder au portail ? (serveur uniquement)
create function public.salarie_connu(p_telephone text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.salaries s
    where s.telephone = p_telephone and prive.phase_entreprise(s.entreprise_id) <> 'bloque'
  )
$$;

-- Rattache le compte à toutes les fiches portant ce numéro (serveur uniquement).
create function public.rattacher_compte_salarie(p_telephone text, p_profil_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre integer;
begin
  update public.salaries set profil_id = p_profil_id
   where telephone = p_telephone and profil_id is distinct from p_profil_id;
  get diagnostics v_nombre = row_count;
  return v_nombre;
end
$$;

revoke all on function public.salarie_connu(text), public.rattacher_compte_salarie(text, uuid) from public, anon, authenticated;
grant execute on function public.salarie_connu(text), public.rattacher_compte_salarie(text, uuid) to service_role;

create function prive.est_mon_salarie(p_salarie_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.salaries s
    where s.id = p_salarie_id
      and s.profil_id = (select auth.uid())
      and prive.phase_entreprise(s.entreprise_id) <> 'bloque'
  )
$$;
revoke all on function prive.est_mon_salarie(uuid) from public;
grant execute on function prive.est_mon_salarie(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Publication (après approbation)
-- ---------------------------------------------------------------------
alter table public.periodes_paie
  add column publiee_le timestamptz,
  add column publiee_par uuid references public.profils (id) on delete set null;

alter table public.validations_periode drop constraint validations_periode_action_check;
alter table public.validations_periode add constraint validations_periode_action_check
  check (action in ('soumission', 'validation', 'refus', 'publication'));

create function prive.peut_publier(p_entreprise_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select prive.gere_entreprise(p_entreprise_id)
    or (
      prive.a_role_entreprise(p_entreprise_id, array['signataire']::public.role_entreprise[])
      and prive.ecriture_permise(prive.phase_entreprise(p_entreprise_id))
    )
$$;
revoke all on function prive.peut_publier(uuid) from public;
grant execute on function prive.peut_publier(uuid) to authenticated;

create function public.peut_publier(p_entreprise_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select prive.peut_publier(p_entreprise_id) $$;

create function public.publier_periode(p_periode_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  p public.periodes_paie;
  v_nombre integer;
begin
  select * into p from public.periodes_paie where id = p_periode_id for update;
  if not found or not prive.peut_publier(p.entreprise_id) then
    raise exception 'Vous ne pouvez pas publier cette période.';
  end if;
  if p.statut <> 'approuvee' then
    raise exception 'Seule une période approuvée peut être publiée.';
  end if;
  update public.periodes_paie
     set statut = 'publiee', publiee_le = now(), publiee_par = (select auth.uid())
   where id = p.id;
  insert into public.validations_periode (periode_id, entreprise_id, cycle, etape, libelle_etape, action, auteur)
  values (p.id, p.entreprise_id, p.cycle, 0, 'Publication aux salariés', 'publication', (select auth.uid()));
  select count(*) into v_nombre from public.bulletins b where b.periode_id = p.id;
  return v_nombre;
end
$$;

revoke all on function public.peut_publier(uuid), public.publier_periode(uuid) from public, anon;
grant execute on function public.peut_publier(uuid), public.publier_periode(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Lecture par le salarié : uniquement ses emplois et ses bulletins publiés
-- ---------------------------------------------------------------------
create function public.mes_emplois()
returns table (
  salarie_id uuid, entreprise_id uuid, raison_sociale text, matricule text, nom text, prenoms text,
  poste text, date_embauche date, statut text, date_sortie date
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.entreprise_id, e.raison_sociale, s.matricule, s.nom, s.prenoms,
         s.poste, s.date_embauche, s.statut::text, s.date_sortie
  from public.salaries s
  join public.entreprises e on e.id = s.entreprise_id
  where prive.est_mon_salarie(s.id)
  order by s.date_embauche desc
$$;

create function public.mes_bulletins()
returns table (
  bulletin_id uuid, salarie_id uuid, raison_sociale text, annee integer, mois integer,
  type text, taille integer, publie_le timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select b.id, b.salarie_id, e.raison_sociale, p.annee, p.mois, b.type::text, b.taille, p.publiee_le
  from public.bulletins b
  join public.periodes_paie p on p.id = b.periode_id
  join public.entreprises e on e.id = b.entreprise_id
  where p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
  order by p.annee desc, p.mois desc, e.raison_sociale
$$;

-- Chemin du fichier d'un de mes bulletins publiés (null sinon)
create function public.fichier_de_mon_bulletin(p_bulletin_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select b.fichier_chemin
  from public.bulletins b
  join public.periodes_paie p on p.id = b.periode_id
  where b.id = p_bulletin_id and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
$$;

revoke all on function public.mes_emplois(), public.mes_bulletins(), public.fichier_de_mon_bulletin(uuid) from public, anon;
grant execute on function public.mes_emplois(), public.mes_bulletins(), public.fichier_de_mon_bulletin(uuid) to authenticated;

-- Stockage : le salarié peut ouvrir le fichier de ses bulletins publiés, rien d'autre.
create function prive.est_mon_bulletin_publie(p_chemin text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bulletins b
    join public.periodes_paie p on p.id = b.periode_id
    where b.fichier_chemin = p_chemin and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id)
  )
$$;
revoke all on function prive.est_mon_bulletin_publie(text) from public;
grant execute on function prive.est_mon_bulletin_publie(text) to authenticated;

create policy bulletins_fichiers_salarie on storage.objects for select to authenticated
using (bucket_id = 'bulletins' and prive.est_mon_bulletin_publie(name));
