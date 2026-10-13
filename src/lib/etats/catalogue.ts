// Catalogue des états (rapports) que l'on peut sortir, par entreprise.
// « disponible » : produit à partir des données déjà présentes ; « bientot » : nécessite
// l'import mensuel des résultats de paie (livre de paie, DTS, DAS, solde de tout compte).

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
  disponible: boolean;
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
  { code: "livre-de-paie", titre: "Livre de paie", description: "Récapitulatif mensuel des éléments de paie de chaque salarié.", groupe: "Paie", parMois: true, disponible: false },
  { code: "solde-tout-compte", titre: "Soldes de tout compte", description: "Sommes dues aux salariés sortis.", groupe: "Paie", parMois: true, disponible: false },
  { code: "dts", titre: "DTS", description: "Déclaration des traitements et salaires.", groupe: "Déclarations", parMois: false, disponible: false },
  { code: "das", titre: "DAS", description: "Déclaration annuelle des salaires.", groupe: "Déclarations", parMois: false, disponible: false },
];

export function etatParCode(code: string): DefinitionEtat | undefined {
  return ETATS.find((e) => e.code === code);
}
