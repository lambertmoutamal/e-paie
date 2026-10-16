-- Code de connexion des salariés envoyé par WhatsApp (Meta), au lieu du SMS Twilio
-- (Twilio n'est pas disponible au Gabon).
-- Supabase crée et vérifie toujours le code (expiration, limites d'essais) ; il appelle cette
-- fonction pour l'ENVOYER (« Send SMS hook », Authentification → Hooks dans Supabase).
-- Les réglages Meta (jeton, identifiant du numéro…) sont lus dans le coffre-fort de Supabase
-- (Vault) : ils ne figurent jamais dans le code. Ils y sont rangés par `npm run whatsapp:coffre`.

create extension if not exists pg_net with schema extensions;

create or replace function public.envoyer_code_whatsapp(event jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_destinataire text := regexp_replace(coalesce(event -> 'user' ->> 'phone', ''), '\D', '', 'g');
  v_code text := event -> 'sms' ->> 'otp';
  v_jeton text;
  v_numero text;
  v_modele text;
  v_langue text;
  v_version text;
  v_corps jsonb;
begin
  select max(decrypted_secret) filter (where name = 'meta_whatsapp_jeton'),
         max(decrypted_secret) filter (where name = 'meta_whatsapp_numero_id'),
         max(decrypted_secret) filter (where name = 'meta_whatsapp_modele_code'),
         max(decrypted_secret) filter (where name = 'meta_whatsapp_langue'),
         max(decrypted_secret) filter (where name = 'meta_whatsapp_version')
    into v_jeton, v_numero, v_modele, v_langue, v_version
    from vault.decrypted_secrets
   where name like 'meta_whatsapp_%';

  if coalesce(v_jeton, '') = '' or coalesce(v_numero, '') = '' or v_destinataire = '' or v_code is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'Envoi du code par WhatsApp non configuré.'));
  end if;

  if coalesce(v_modele, '') = '' then
    -- Essais : simple texte (WhatsApp ne le livre que si la personne a écrit dans les 24 h)
    v_corps := jsonb_build_object(
      'messaging_product', 'whatsapp', 'to', v_destinataire, 'type', 'text',
      'text', jsonb_build_object('body', 'DématPaie : votre code de connexion est ' || v_code || '. Il expire dans quelques minutes. Ne le communiquez à personne.'));
  else
    -- Production : modèle « authentification » approuvé par Meta (code + bouton « Copier le code »)
    v_corps := jsonb_build_object(
      'messaging_product', 'whatsapp', 'to', v_destinataire, 'type', 'template',
      'template', jsonb_build_object(
        'name', v_modele,
        'language', jsonb_build_object('code', coalesce(nullif(v_langue, ''), 'fr')),
        'components', jsonb_build_array(
          jsonb_build_object('type', 'body', 'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_code))),
          jsonb_build_object('type', 'button', 'sub_type', 'url', 'index', '0', 'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_code))))));
  end if;

  perform net.http_post(
    url := 'https://graph.facebook.com/' || coalesce(nullif(v_version, ''), 'v25.0') || '/' || v_numero || '/messages',
    body := v_corps,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_jeton, 'Content-Type', 'application/json'),
    timeout_milliseconds := 10000);
  return '{}'::jsonb;
end
$$;

-- Réservée au service d'authentification de Supabase : ni les visiteurs, ni les utilisateurs.
revoke all on function public.envoyer_code_whatsapp(jsonb) from public, anon, authenticated;
grant execute on function public.envoyer_code_whatsapp(jsonb) to supabase_auth_admin;
