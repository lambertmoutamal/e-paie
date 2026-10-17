// Tarifs publics affichés sur le site vitrine (demande du porteur du projet du 2026-10-17,
// à consigner dans docs/decisions.md une fois validée).
//
// Important : ces montants servent uniquement à l'AFFICHAGE. Le montant réellement payé est
// calculé à partir de la table « formules » (prix modifiable par l'administrateur plateforme).
// La facturation « par salarié » des entreprises n'existe pas encore dans le modèle d'abonnement :
// le jour où elle sera ajoutée, la vitrine devra lire ses prix dans la base.

export const DEVISE_AFFICHEE = "FCFA";

// Durée de l'essai gratuit, identique à la formule « essai » de la base (30 jours).
export const DUREE_ESSAI_JOURS = 30;

export type Tarif = {
  cible: "cabinet" | "entreprise";
  titre: string;
  prixMensuel: number;
  unite: string;
  accroche: string;
  points: string[];
  inscription: string;
};

export const TARIFS: Tarif[] = [
  {
    cible: "cabinet",
    titre: "Cabinet comptable",
    prixMensuel: 20000,
    unite: "par mois",
    accroche: "Un prix fixe pour gérer la paie de vos entreprises clientes.",
    points: [
      "Toutes vos entreprises clientes dans un seul espace",
      "Rôles par client et circuit de validation",
      "Portail salarié inclus pour les salariés de vos clients",
    ],
    inscription: "/inscription?type=cabinet",
  },
  {
    cible: "entreprise",
    titre: "Entreprise",
    prixMensuel: 2000,
    unite: "par salarié et par mois",
    accroche: "Vous ne payez que pour les salariés que vous gérez.",
    points: [
      "Dossiers salariés, contrats et congés",
      "Dépôt, validation et publication des bulletins",
      "Portail salarié inclus, sur téléphone",
    ],
    inscription: "/inscription?type=entreprise",
  },
];

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// « 20000 » → « 20 000 FCFA », avec des espaces insécables : le prix ne se coupe jamais en fin de ligne.
export function formaterPrix(montant: number): string {
  return `${NOMBRE.format(montant).replace(/[   ]/g, " ")} ${DEVISE_AFFICHEE}`;
}
