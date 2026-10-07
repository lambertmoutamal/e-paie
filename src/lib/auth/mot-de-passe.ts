import { randomInt } from "node:crypto";

// Sans caractères ambigus (0/O, 1/l/I) pour une transmission orale ou écrite sans erreur.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Exemple : « Kx7m-Pq2r-Zt9w » (12 caractères aléatoires, environ 70 bits).
export function genererMotDePasseProvisoire(): string {
  const groupes = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  );
  return groupes.join("-");
}

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
