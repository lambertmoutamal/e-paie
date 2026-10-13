// Règle « une seule entreprise à la fois » : sans entreprise de travail choisie, l'espace
// privé renvoie vers l'écran de choix. Fichier sans dépendance serveur : utilisé par proxy.ts.

export const COOKIE_ENTREPRISE = "dematpaie_entreprise";

// Pages accessibles sans entreprise de travail (compte, abonnement, administration de la plateforme)
const PAGES_LIBRES = [
  "/espace/mot-de-passe",
  "/espace/profil",
  "/espace/abonnement",
  "/espace/modules",
  "/espace/cabinets",
  "/espace/demandes-demo",
  "/espace/fichiers",
];

export function exigeEntrepriseChoisie(chemin: string): boolean {
  if (chemin !== "/espace" && !chemin.startsWith("/espace/")) return false;
  return !PAGES_LIBRES.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}
