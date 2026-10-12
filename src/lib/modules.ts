// Catalogue des modules d'DématPaie (inspiré de l'organisation des SIRH du marché).
// Source unique pour le menu, le tableau de bord, la fiche entreprise et le site vitrine.
// « disponible » : utilisable aujourd'hui ; « bientot » : prévu au plan (docs/plan.md).

export type IdModule = "administration" | "bulletins" | "absences" | "self-service" | "notes-de-frais" | "pilotage" | "paie";

export type Module = {
  id: IdModule;
  nom: string;
  accroche: string;
  fonctions: { libelle: string; disponible: boolean }[];
  statut: "disponible" | "bientot";
  // Page du module pour une entreprise donnée (si disponible)
  lienEntreprise?: (entrepriseId: string) => string;
};

export const MODULES: Module[] = [
  {
    id: "administration",
    nom: "Gestion administrative",
    accroche: "Dossiers salariés, import Excel, contrats et échéances.",
    statut: "disponible",
    lienEntreprise: (id) => `/espace/entreprises/${id}/salaries`,
    fonctions: [
      { libelle: "Fiches salariés et sortie du personnel", disponible: true },
      { libelle: "Import des salariés depuis Excel", disponible: true },
      { libelle: "Contrats, avenants, renouvellements et documents du salarié", disponible: true },
      { libelle: "Échéances : fins de CDD et de périodes d'essai", disponible: true },
      { libelle: "Salariés prévisionnels (embauches à venir)", disponible: true },
    ],
  },
  {
    id: "bulletins",
    nom: "Bulletins & coffre-fort",
    accroche: "Dépôt, validation et publication des bulletins, archivés durablement.",
    statut: "disponible",
    lienEntreprise: (id) => `/espace/entreprises/${id}/paie`,
    fonctions: [
      { libelle: "Périodes de paie mensuelles", disponible: true },
      { libelle: "Dépôt des bulletins PDF : un par un, en masse, ou un seul PDF découpé automatiquement par matricule", disponible: true },
      { libelle: "Circuit de validation configurable (1 à 5 étapes, refus commenté, verrouillage)", disponible: true },
      { libelle: "Publication aux salariés et coffre-fort numérique (historique complet)", disponible: true },
    ],
  },
  {
    id: "absences",
    nom: "Congés & absences",
    accroche: "Demandes, validation et soldes de congés, sans papier.",
    statut: "disponible",
    lienEntreprise: (id) => `/espace/entreprises/${id}/absences`,
    fonctions: [
      { libelle: "Demandes de congé et de permission depuis le téléphone, avec justificatif", disponible: true },
      { libelle: "Validation par le RH, alertes email et WhatsApp", disponible: true },
      { libelle: "Soldes calculés automatiquement, jours fériés, demi-journées", disponible: true },
      { libelle: "Planning mensuel des absences", disponible: true },
    ],
  },
  {
    id: "self-service",
    nom: "Self-service salarié & manager",
    accroche: "Le salarié et son responsable gèrent l'essentiel depuis leur téléphone.",
    statut: "disponible",
    lienEntreprise: (id) => `/espace/entreprises/${id}/reclamations`,
    fonctions: [
      { libelle: "Portail salarié : connexion par téléphone (SMS ou WhatsApp), bulletins et historique", disponible: true },
      { libelle: "Réclamations avec échanges, pièces jointes et suivi", disponible: true },
      { libelle: "Espace manager : équipe et validations", disponible: false },
    ],
  },
  {
    id: "notes-de-frais",
    nom: "Notes de frais",
    accroche: "Saisie avec justificatif photo, validation et suivi des remboursements.",
    statut: "bientot",
    fonctions: [
      { libelle: "Saisie depuis le téléphone avec photo du justificatif", disponible: false },
      { libelle: "Validation par le manager", disponible: false },
    ],
  },
  {
    id: "pilotage",
    nom: "Pilotage",
    accroche: "Tableaux de bord et rapports : effectifs, mouvements, absences.",
    statut: "bientot",
    fonctions: [
      { libelle: "Effectifs, entrées et sorties", disponible: false },
      { libelle: "Absentéisme et congés", disponible: false },
      { libelle: "Exports Excel", disponible: false },
    ],
  },
  {
    id: "paie",
    nom: "Calcul de la paie",
    accroche: "Rubriques, taux et plafonds paramétrables, calcul et contrôle automatiques.",
    statut: "bientot",
    fonctions: [
      { libelle: "Paramétrage des rubriques et taux", disponible: false },
      { libelle: "Calcul et contrôle de la paie", disponible: false },
    ],
  },
];

export function moduleParId(id: string): Module | undefined {
  return MODULES.find((m) => m.id === id);
}
