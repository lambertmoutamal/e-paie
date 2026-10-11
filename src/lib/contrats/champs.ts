// Champs automatiques des modèles de contrat : {{cle}} est remplacé par la valeur réelle.

export const CHAMPS_DOCUMENT = [
  { cle: "raison_sociale", libelle: "Raison sociale de l'entreprise", groupe: "Entreprise" },
  { cle: "adresse_entreprise", libelle: "Adresse de l'entreprise", groupe: "Entreprise" },
  { cle: "rccm", libelle: "RCCM", groupe: "Entreprise" },
  { cle: "nif", libelle: "NIF", groupe: "Entreprise" },
  { cle: "numero_cnss_entreprise", libelle: "N° CNSS de l'entreprise", groupe: "Entreprise" },
  { cle: "civilite", libelle: "Civilité (Madame / Monsieur)", groupe: "Salarié" },
  { cle: "nom", libelle: "Nom", groupe: "Salarié" },
  { cle: "prenoms", libelle: "Prénoms", groupe: "Salarié" },
  { cle: "date_naissance", libelle: "Date de naissance", groupe: "Salarié" },
  { cle: "nationalite", libelle: "Nationalité", groupe: "Salarié" },
  { cle: "adresse_salarie", libelle: "Adresse du salarié", groupe: "Salarié" },
  { cle: "matricule", libelle: "Matricule", groupe: "Salarié" },
  { cle: "numero_cnss_salarie", libelle: "N° CNSS du salarié", groupe: "Salarié" },
  { cle: "type_contrat", libelle: "Type de contrat", groupe: "Contrat" },
  { cle: "poste", libelle: "Poste", groupe: "Contrat" },
  { cle: "categorie", libelle: "Catégorie", groupe: "Contrat" },
  { cle: "salaire_base", libelle: "Salaire de base", groupe: "Contrat" },
  { cle: "heures_hebdo", libelle: "Heures par semaine", groupe: "Contrat" },
  { cle: "lieu_travail", libelle: "Lieu de travail", groupe: "Contrat" },
  { cle: "date_debut", libelle: "Date de début (ou d'effet)", groupe: "Contrat" },
  { cle: "date_fin", libelle: "Date de fin prévue", groupe: "Contrat" },
  { cle: "fin_periode_essai", libelle: "Fin de la période d'essai", groupe: "Contrat" },
  { cle: "objet_avenant", libelle: "Objet de l'avenant", groupe: "Contrat" },
  { cle: "date_du_jour", libelle: "Date du jour", groupe: "Autres" },
] as const;
export type CleChamp = (typeof CHAMPS_DOCUMENT)[number]["cle"];
