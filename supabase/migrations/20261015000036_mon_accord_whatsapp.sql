-- Le salarié connecté a-t-il accepté les avis WhatsApp ? (il ne lit pas sa fiche directement)
create function public.mon_accord_whatsapp()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(bool_or(s.accord_whatsapp_le is not null), false)
  from public.salaries s
  where prive.est_mon_salarie(s.id)
$$;
revoke all on function public.mon_accord_whatsapp() from public, anon;
grant execute on function public.mon_accord_whatsapp() to authenticated;
