"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { estCookieDeSession } from "@/lib/auth/session";
import { lireCanal, lireCode, lireTelephone, messageErreurCode, type Canal, type EtatPortail } from "@/lib/portail/regles";

const DELAI_ENTRE_CODES = 60; // secondes

// Étape 1 : envoi du code. Le message est le même que le numéro soit connu ou non
// (on ne révèle pas qui est salarié). Un code n'est réellement envoyé (et facturé)
// que pour un numéro enregistré par un employeur dont l'abonnement est actif.
export async function demanderCode(_e: EtatPortail, formulaire: FormData): Promise<EtatPortail> {
  const saisie = String(formulaire.get("telephone") ?? "");
  const indicatif = String(formulaire.get("indicatif") ?? "+241");
  const canal = lireCanal(formulaire.get("canal"));
  const telephone = lireTelephone(saisie, indicatif);
  if (!telephone) return { etape: "telephone", erreur: "Numéro de téléphone invalide.", telephone: saisie, indicatif, canal };

  const admin = clientSupabaseAdmin();
  const { data: reserve, error: erreurReserve } = await admin.rpc("reserver_envoi_email", {
    p_cle: `otp:${telephone}`,
    p_delai_secondes: DELAI_ENTRE_CODES,
  });
  if (erreurReserve) {
    console.error("Portail : contrôle anti-abus indisponible :", erreurReserve.message);
    return { etape: "telephone", erreur: "Le service est momentanément indisponible. Réessayez dans un instant.", telephone: saisie, indicatif, canal };
  }
  if (reserve !== true) {
    return { etape: "code", telephone, canal, info: "Un code vient déjà d'être envoyé. Patientez une minute avant d'en demander un autre." };
  }

  const { data: connu, error: erreurConnu } = await admin.rpc("salarie_connu", { p_telephone: telephone });
  if (erreurConnu) {
    console.error("Portail : recherche du salarié impossible :", erreurConnu.message);
    return { etape: "telephone", erreur: "Le service est momentanément indisponible. Réessayez dans un instant.", telephone: saisie, indicatif, canal };
  }
  if (connu === true) {
    const erreur = await envoyerCode(telephone, canal);
    if (erreur) return { etape: "telephone", erreur, telephone: saisie, indicatif, canal };
  }
  return { etape: "code", telephone, canal };
}

async function envoyerCode(telephone: string, canal: Canal): Promise<string | null> {
  // Le compte du salarié est créé à sa première connexion (téléphone déjà vérifié par l'employeur).
  const admin = clientSupabaseAdmin();
  const { error: erreurCreation } = await admin.auth.admin.createUser({
    phone: telephone,
    phone_confirm: true,
    app_metadata: { type: "salarie" },
  });
  if (erreurCreation && erreurCreation.code !== "phone_exists") {
    console.error("Portail : création du compte salarié impossible :", erreurCreation.code, erreurCreation.message);
    return "Le service est momentanément indisponible. Réessayez dans un instant.";
  }

  const supabase = await clientSupabaseServeur();
  // Supabase crée le code et le confie à la fonction d'envoi de la base, qui le transmet par
  // WhatsApp (Meta) : le canal demandé à Supabase reste donc « sms ».
  const { error } = await supabase.auth.signInWithOtp({ phone: telephone, options: { shouldCreateUser: false, channel: "sms" } });
  if (error) {
    console.error("Portail : envoi du code impossible :", error.code, error.message);
    if (error.code === "over_sms_send_rate_limit" || error.code === "over_request_rate_limit") {
      return "Trop de demandes. Patientez quelques minutes puis réessayez.";
    }
    return `Le code n'a pas pu être envoyé par ${canal === "whatsapp" ? "WhatsApp" : "SMS"}. Vérifiez le numéro ou réessayez dans un instant.`;
  }
  return null;
}

// Étape 2 : vérification du code, ouverture de la session et rattachement aux fiches salarié.
export async function verifierCode(telephone: string, canal: Canal, _e: EtatPortail, formulaire: FormData): Promise<EtatPortail> {
  const code = lireCode(String(formulaire.get("code") ?? ""));
  if (!code) return { etape: "code", telephone, canal, erreur: "Saisissez les 6 chiffres reçus." };

  const supabase = await clientSupabaseServeur();
  const { data, error } = await supabase.auth.verifyOtp({ phone: telephone, token: code, type: "sms" });
  if (error || !data.user) return { etape: "code", telephone, canal, erreur: messageErreurCode(error?.code) };

  // Sécurité : ce parcours est réservé aux comptes salariés (jamais un compte du personnel).
  if (data.user.app_metadata?.type !== "salarie" || data.user.email) {
    await supabase.auth.signOut({ scope: "local" });
    return { etape: "telephone", erreur: "Ce numéro ne correspond pas à un compte salarié." };
  }

  await clientSupabaseAdmin().rpc("rattacher_compte_salarie", { p_telephone: telephone, p_profil_id: data.user.id });
  redirect("/portail");
}

export async function deconnecterSalarie() {
  const supabase = await clientSupabaseServeur();
  await supabase.auth.signOut({ scope: "local" });
  const magasinCookies = await cookies();
  for (const { name } of magasinCookies.getAll()) {
    if (estCookieDeSession(name)) magasinCookies.delete(name);
  }
  redirect("/portail/connexion");
}
