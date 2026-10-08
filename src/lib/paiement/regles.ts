// Règles de paiement, indépendantes du prestataire (faciles à tester).

export type DureeAbonnement = 1 | 12;
export type StatutPaiement = "initie" | "en_cours" | "reussi" | "echoue" | "expire" | "annule";

// Abonnement annuel : 2 mois offerts → 10 fois le prix mensuel (décision du 2026-10-08).
export const MOIS_PAYES_POUR_UN_AN = 10;

export function montantAPayer(prixMensuel: number, duree: DureeAbonnement): number {
  return prixMensuel * (duree === 12 ? MOIS_PAYES_POUR_UN_AN : 1);
}

// Numéro Mobile Money au format international E.164 (ex. « +241 77 12 34 56 » → « +24177123456 »).
// Renvoie null si le format est invalide.
export function normaliserTelephone(saisie: string): string | null {
  const nettoye = saisie.replace(/[\s.\-()]/g, "");
  const avecPlus = nettoye.startsWith("00") ? `+${nettoye.slice(2)}` : nettoye;
  return /^\+[1-9]\d{7,14}$/.test(avecPlus) ? avecPlus : null;
}

export function estTermine(statut: StatutPaiement): boolean {
  return statut === "reussi" || statut === "echoue" || statut === "expire" || statut === "annule";
}

export const LIBELLES_STATUT: Record<StatutPaiement, { libelle: string; teinte: "vert" | "bleu" | "ambre" | "rouge" | "gris" }> = {
  initie: { libelle: "En attente de validation", teinte: "ambre" },
  en_cours: { libelle: "En cours", teinte: "bleu" },
  reussi: { libelle: "Payé", teinte: "vert" },
  echoue: { libelle: "Échoué", teinte: "rouge" },
  expire: { libelle: "Expiré", teinte: "gris" },
  annule: { libelle: "Annulé", teinte: "gris" },
};
