// Nom affiché de l'expéditeur des emails : toujours « DématPaie », quel que soit le nom
// écrit dans EMAIL_EXPEDITEUR (seule l'adresse est reprise). Fonction pure (testée).
export const NOM_EXPEDITEUR = "DématPaie";

export function expediteurDematPaie(valeur: string): string | null {
  const adresse = (valeur.match(/<([^<>]+)>/)?.[1] ?? valeur).trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(adresse)) return null;
  return `${NOM_EXPEDITEUR} <${adresse}>`;
}
