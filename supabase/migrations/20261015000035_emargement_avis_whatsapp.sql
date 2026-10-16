-- Avis de bulletin par WhatsApp et émargement électronique
--   * à la publication, chaque salarié qui l'a accepté reçoit un message WhatsApp avec le lien
--     de son espace (le bulletin lui-même ne passe jamais par WhatsApp) ;
--   * le téléchargement du bulletin par le salarié vaut émargement (accusé de réception),
--     visible par l'employeur et apposé sur l'exemplaire qu'il conserve.

-- ---------------------------------------------------------------------
-- Accord du salarié pour recevoir ses avis par WhatsApp (date de l'accord, null = non)
-- ---------------------------------------------------------------------
alter table public.salaries add column if not exists accord_whatsapp_le timestamptz;

-- Le salarié donne ou retire son accord depuis son espace (toutes ses fiches)
create function public.definir_mon_accord_whatsapp(p_accord boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.salaries s
     set accord_whatsapp_le = case when p_accord then coalesce(s.accord_whatsapp_le, now()) end
   where prive.est_mon_salarie(s.id);
end
$$;

-- ---------------------------------------------------------------------
-- Émargement électronique : premier téléchargement du bulletin par le salarié
-- ---------------------------------------------------------------------
create table public.emargements_bulletins (
  bulletin_id uuid primary key references public.bulletins (id) on delete cascade,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete cascade,
  profil_id uuid references public.profils (id) on delete set null,
  emarge_le timestamptz not null default now(),
  adresse_ip text,
  navigateur text
);
create index emargements_bulletins_entreprise_idx on public.emargements_bulletins (entreprise_id);

alter table public.emargements_bulletins enable row level security;
-- Lecture : l'entreprise et le salarié concerné. Aucune écriture directe (fonction ci-dessous).
create policy emargements_lecture on public.emargements_bulletins
  for select to authenticated
  using (prive.a_acces_entreprise(entreprise_id) or prive.est_mon_salarie(salarie_id));
revoke all on public.emargements_bulletins from public, anon, authenticated;
grant select on public.emargements_bulletins to authenticated;

create trigger journaliser after insert or update or delete on public.emargements_bulletins
  for each row execute function prive.journaliser('entreprise_id', '');

-- Appelée au téléchargement : seulement pour SON bulletin publié ; le premier émargement est conservé.
create function public.emarger_mon_bulletin(p_bulletin_id uuid, p_adresse_ip text default null, p_navigateur text default null)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_bulletin public.bulletins;
  v_date timestamptz;
begin
  select b.* into v_bulletin
  from public.bulletins b
  join public.periodes_paie p on p.id = b.periode_id
  where b.id = p_bulletin_id and p.statut = 'publiee' and prive.est_mon_salarie(b.salarie_id);
  if not found then
    raise exception 'Bulletin introuvable.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.emargements_bulletins (bulletin_id, entreprise_id, salarie_id, profil_id, adresse_ip, navigateur)
  values (v_bulletin.id, v_bulletin.entreprise_id, v_bulletin.salarie_id, auth.uid(), left(p_adresse_ip, 64), left(p_navigateur, 300))
  on conflict (bulletin_id) do nothing;

  select emarge_le into v_date from public.emargements_bulletins where bulletin_id = v_bulletin.id;
  return v_date;
end
$$;

-- ---------------------------------------------------------------------
-- Avis envoyés aux salariés (écrits par le serveur uniquement)
-- ---------------------------------------------------------------------
create table public.avis_bulletins (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.bulletins (id) on delete cascade,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  periode_id uuid not null references public.periodes_paie (id) on delete cascade,
  salarie_id uuid not null references public.salaries (id) on delete cascade,
  canal text not null default 'whatsapp' check (canal in ('whatsapp')),
  statut text not null check (statut in ('simule', 'envoye', 'recu', 'lu', 'echec')),
  message_sid text unique,
  erreur text,
  envoye_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);
create index avis_bulletins_periode_idx on public.avis_bulletins (periode_id);
create index avis_bulletins_bulletin_idx on public.avis_bulletins (bulletin_id);

alter table public.avis_bulletins enable row level security;
create policy avis_bulletins_lecture on public.avis_bulletins
  for select to authenticated
  using (prive.a_acces_entreprise(entreprise_id));
revoke all on public.avis_bulletins from public, anon, authenticated;
grant select on public.avis_bulletins to authenticated;

revoke all on function public.definir_mon_accord_whatsapp(boolean), public.emarger_mon_bulletin(uuid, text, text) from public, anon;
grant execute on function public.definir_mon_accord_whatsapp(boolean), public.emarger_mon_bulletin(uuid, text, text) to authenticated;
