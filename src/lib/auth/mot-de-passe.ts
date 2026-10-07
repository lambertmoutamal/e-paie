export function messageErreurMotDePasse(code?: string): string {
  switch (code) {
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    case "weak_password":
      return "Ce mot de passe est trop faible. Choisissez-en un plus long.";
    case "reauthentication_needed":
      return "Pour des raisons de sécurité, déconnectez-vous puis reconnectez-vous avant de changer le mot de passe.";
    default:
      return "Le changement de mot de passe a échoué. Réessayez dans un instant.";
  }
}
