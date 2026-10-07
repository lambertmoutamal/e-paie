import { Champ, ChoixListe } from "@/components/formulaire";

export type FicheEntreprise = {
  raison_sociale: string;
  nif: string | null;
  rccm: string | null;
  numero_cnss: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  mode: string;
};

export const OPTIONS_MODE = [
  { valeur: "cabinet", libelle: "Mode cabinet : le cabinet fait la paie" },
  { valeur: "autonome", libelle: "Mode autonome : l'entreprise fait sa paie" },
];

// Champs communs à la création et à la modification d'une fiche entreprise.
export function ChampsEntreprise({ fiche }: { fiche?: FicheEntreprise }) {
  return (
    <>
      <Champ nom="raison_sociale" libelle="Raison sociale" requis pleineLargeur valeurInitiale={fiche?.raison_sociale} />
      <Champ nom="nif" libelle="NIF" valeurInitiale={fiche?.nif} />
      <Champ nom="rccm" libelle="RCCM" valeurInitiale={fiche?.rccm} />
      <Champ nom="numero_cnss" libelle="N° employeur CNSS" valeurInitiale={fiche?.numero_cnss} />
      <Champ nom="telephone" libelle="Téléphone" type="tel" valeurInitiale={fiche?.telephone} />
      <Champ nom="email" libelle="Email de l'entreprise" type="email" valeurInitiale={fiche?.email} />
      <Champ nom="adresse" libelle="Adresse" valeurInitiale={fiche?.adresse} />
      <ChoixListe
        nom="mode"
        libelle="Mode d'utilisation"
        options={OPTIONS_MODE}
        valeurInitiale={fiche?.mode ?? "cabinet"}
        requis
        pleineLargeur
      />
    </>
  );
}
