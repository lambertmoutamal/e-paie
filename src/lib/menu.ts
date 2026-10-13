// Menu principal : groupes de tâches affichés dans la barre du haut avec un menu déroulant.
// Les liens visent l'entreprise de travail choisie à la connexion (une seule à la fois) ;
// sans entreprise choisie, ils mènent à l'écran de choix.

import { ETATS } from "@/lib/etats/catalogue";

export type TacheMenu = { libelle: string; href: string; description?: string; bientot?: boolean };
export type GroupeMenu = { id: string; libelle: string; taches: TacheMenu[]; sections?: { titre: string; taches: TacheMenu[] }[] };

export function groupesMenu({
  entrepriseId,
  adminPlateforme,
  administrateur,
  voitAbonnement,
}: {
  entrepriseId: string | null;
  adminPlateforme: boolean;
  administrateur: boolean;
  voitAbonnement: boolean;
}): GroupeMenu[] {
  const e = (chemin: string) => (entrepriseId ? `/espace/entreprises/${entrepriseId}${chemin}` : "/choix-entreprise");
  const etat = (code: string) => `/espace/etats/${code}`;

  const sectionsEtats = (["Personnel", "Congés et absences", "Paie", "Déclarations"] as const).map((g) => ({
    titre: g,
    taches: ETATS.filter((x) => x.groupe === g).map((x) => ({ libelle: x.titre, href: etat(x.code), bientot: !x.disponible })),
  }));

  return [
    {
      id: "salaries",
      libelle: "Salariés",
      taches: [
        { libelle: "Liste des salariés", href: e("/salaries"), description: "Rechercher, filtrer, ouvrir une fiche" },
        { libelle: "Ajouter un salarié", href: e("/salaries/nouveau") },
        { libelle: "Importer depuis Excel", href: e("/salaries/importer") },
        { libelle: "Modèles de contrat", href: e("/modeles-contrat"), description: "Rédiger les contrats dans DématPaie" },
        { libelle: "Contrats et échéances", href: etat("contrats") },
      ],
    },
    {
      id: "paie",
      libelle: "Paie",
      taches: [
        { libelle: "Périodes et bulletins", href: e("/paie"), description: "Créer la période, déposer les bulletins" },
        { libelle: "Circuit de validation", href: e("/paie/circuit") },
        { libelle: "Registre des bulletins", href: etat("bulletins") },
        { libelle: "Import des résultats de paie", href: e("/paie"), description: "Ouvrir la période, puis « Résultats de paie »" },
      ],
    },
    {
      id: "absences",
      libelle: "Absences",
      taches: [
        { libelle: "Demandes à traiter", href: e("/absences"), description: "Accepter, refuser, saisir une absence" },
        { libelle: "Planning du mois", href: e("/absences/planning"), description: "Et congés prévisionnels" },
        { libelle: "Soldes de congés", href: e("/absences/soldes") },
        { libelle: "Réglages des congés", href: e("/absences/reglages") },
      ],
    },
    {
      id: "reclamations",
      libelle: "Réclamations",
      taches: [
        { libelle: "À traiter et en cours", href: e("/reclamations") },
        { libelle: "Toutes les réclamations", href: e("/reclamations?statut=toutes") },
        { libelle: "Réclamations du mois (état)", href: etat("reclamations") },
      ],
    },
    {
      id: "etats",
      libelle: "États",
      taches: [{ libelle: "Tous les états", href: "/espace/etats" }],
      sections: sectionsEtats,
    },
    {
      id: "parametres",
      libelle: "Paramètres",
      taches: [
        ...(entrepriseId ? [{ libelle: "Fiche de l'entreprise et utilisateurs", href: e("") }] : []),
        ...(administrateur
          ? [
              { libelle: "Liste des entreprises", href: "/espace/entreprises", description: "Administration des entreprises du cabinet" },
              { libelle: "Nouvelle entreprise", href: "/espace/entreprises/nouvelle" },
            ]
          : []),
        ...(adminPlateforme
          ? [
              { libelle: "Cabinets", href: "/espace/cabinets" },
              { libelle: "Demandes de démo", href: "/espace/demandes-demo" },
            ]
          : []),
        ...(voitAbonnement ? [{ libelle: adminPlateforme ? "Abonnements" : "Mon abonnement", href: "/espace/abonnement" }] : []),
        { libelle: "Catalogue des modules", href: "/espace/modules" },
        { libelle: "Mon profil", href: "/espace/profil" },
      ],
    },
  ];
}
