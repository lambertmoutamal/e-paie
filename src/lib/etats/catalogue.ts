// Catalogue des états (rapports) que l'on peut sortir, par entreprise.
// Le livre de paie, les soldes de tout compte, la DTS et la DAS sont produits à partir
// des résultats de paie importés chaque mois (Excel du logiciel de paie).

export type CodeEtat =
  | "conges-du-mois"
  | "soldes-conges"
  | "personnel"
  | "entrees-sorties"
  | "contrats"
  | "bulletins"
  | "absences-par-type"
  | "reclamations"
  | "livre-de-paie"
  | "dts"
  | "das"
  | "solde-tout-compte";

export type DefinitionEtat = {
  code: CodeEtat;
  titre: string;
  description: string;
  groupe: "Personnel" | "Congés et absences" | "Paie" | "Déclarations";
  parMois: boolean;
  parAnnee?: boolean;
  disponible: boolean;
  // Produit à partir des résultats de paie importés
  depuisResultats?: boolean;
};

export const ETATS: DefinitionEtat[] = [
  { code: "personnel", titre: "Liste du personnel", description: "Salariés en poste : identité, poste, contrat, coordonnées.", groupe: "Personnel", parMois: false, disponible: true },
  { code: "entrees-sorties", titre: "Entrées et sorties du mois", description: "Embauches et départs du mois.", groupe: "Personnel", parMois: true, disponible: true },
  { code: "contrats", titre: "Contrats et échéances", description: "Contrats en cours, fins de CDD et de période d'essai.", groupe: "Personnel", parMois: false, disponible: true },
  { code: "reclamations", titre: "Réclamations du mois", description: "Réclamations ouvertes dans le mois, par sujet et statut.", groupe: "Personnel", parMois: true, disponible: true },
  { code: "conges-du-mois", titre: "Congés et absences du mois", description: "Toutes les absences acceptées sur le mois.", groupe: "Congés et absences", parMois: true, disponible: true },
  { code: "absences-par-type", titre: "Absences par type", description: "Nombre de jours d'absence par type sur le mois.", groupe: "Congés et absences", parMois: true, disponible: true },
  { code: "soldes-conges", titre: "Soldes de congés", description: "Acquis, pris, en attente et disponible de chaque salarié.", groupe: "Congés et absences", parMois: false, disponible: true },
  { code: "bulletins", titre: "Registre des bulletins", description: "Bulletins déposés et publiés pour le mois, avec leur empreinte.", groupe: "Paie", parMois: true, disponible: true },
  { code: "livre-de-paie", titre: "Livre de paie", description: "Éléments de paie de chaque salarié pour le mois, avec totaux.", groupe: "Paie", parMois: true, disponible: true, depuisResultats: true },
  { code: "solde-tout-compte", titre: "Soldes de tout compte", description: "Salariés sortis dans le mois : sommes versées et reçu à signer.", groupe: "Paie", parMois: true, disponible: true, depuisResultats: true },
  { code: "dts", titre: "DTS", description: "Déclaration des traitements et salaires : cumuls annuels imposables et impôt retenu.", groupe: "Déclarations", parMois: false, parAnnee: true, disponible: true, depuisResultats: true },
  { code: "das", titre: "DAS", description: "Déclaration annuelle des salaires : cumuls annuels soumis à cotisations sociales.", groupe: "Déclarations", parMois: false, parAnnee: true, disponible: true, depuisResultats: true },
];

export function etatParCode(code: string): DefinitionEtat | undefined {
  return ETATS.find((e) => e.code === code);
}
