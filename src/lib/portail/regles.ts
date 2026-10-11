// Règles de la connexion des salariés par téléphone (sans dépendance à Supabase).

import { normaliserTelephoneSalarie } from "@/lib/salaries/regles";

export type Canal = "sms" | "whatsapp";

export type EtatPortail =
  | { etape?: "telephone"; erreur?: string; telephone?: string; indicatif?: string; canal?: Canal }
  | { etape: "code"; telephone: string; canal: Canal; erreur?: string; info?: string }
  | undefined;

export const INDICATIFS = [
  ["+241", "Gabon (+241)"],
  ["+237", "Cameroun (+237)"],
  ["+242", "Congo (+242)"],
  ["+235", "Tchad (+235)"],
  ["+236", "Centrafrique (+236)"],
  ["+240", "Guinée équatoriale (+240)"],
  ["+225", "Côte d'Ivoire (+225)"],
  ["+221", "Sénégal (+221)"],
  ["+229", "Bénin (+229)"],
  ["+228", "Togo (+228)"],
  ["+226", "Burkina Faso (+226)"],
  ["+223", "Mali (+223)"],
  ["+33", "France (+33)"],
] as const;

// Lit le numéro saisi : « 077 12 34 56 » avec l'indicatif choisi, ou un numéro complet « +241… ».
export function lireTelephone(saisie: string, indicatif: string): string | null {
  const indicatifValide = INDICATIFS.some(([valeur]) => valeur === indicatif) ? indicatif : "+241";
  return normaliserTelephoneSalarie(saisie.trim(), indicatifValide);
}

export function lireCanal(valeur: unknown): Canal {
  return valeur === "whatsapp" ? "whatsapp" : "sms";
}

export function lireCode(saisie: string): string | null {
  const code = saisie.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

// Numéro masqué pour l'affichage : +241 •• •• 34 56
export function masquerTelephone(telephone: string): string {
  return `${telephone.slice(0, -4).replace(/\d/g, "•")}${telephone.slice(-4)}`;
}

export function messageErreurCode(code?: string): string {
  switch (code) {
    case "otp_expired":
      return "Ce code a expiré ou est incorrect. Demandez un nouveau code.";
    case "over_request_rate_limit":
    case "over_sms_send_rate_limit":
      return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
  }
  return "Code incorrect. Vérifiez les 6 chiffres reçus.";
}
