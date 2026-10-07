// Règles de la connexion, sans dépendance à Supabase : faciles à tester.

export type EtatConnexion = { erreur?: string; email?: string } | undefined;

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validerConnexion(email: string, motDePasse: string): string | null {
  if (!email || !motDePasse) return "Veuillez saisir votre email et votre mot de passe.";
  if (!FORMAT_EMAIL.test(email)) return "L'adresse email n'est pas valide.";
  return null;
}

// Traduit les erreurs de Supabase en messages clairs.
// Volontairement, on ne dit pas si c'est l'email ou le mot de passe qui est faux.
export function messageErreurConnexion(code?: string, statut?: number): string {
  switch (code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Votre adresse email n'est pas encore confirmée.";
    case "user_banned":
      return "Ce compte est désactivé. Contactez votre administrateur.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
  }
  if (statut === 0 || statut === undefined) {
    return "Connexion au serveur impossible. Vérifiez votre connexion internet.";
  }
  return "La connexion a échoué. Réessayez dans un instant.";
}
