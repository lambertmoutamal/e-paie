import { Champ, ChoixListe, TitreGroupe } from "@/components/formulaire";

export type FicheSalarie = {
  matricule: string;
  nom: string;
  prenoms: string;
  sexe: string | null;
  date_naissance: string | null;
  nationalite: string | null;
  poste: string | null;
  date_embauche: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  numero_cnss: string | null;
  banque: string | null;
  numero_compte: string | null;
};

// Champs communs à la création et à la modification d'une fiche salarié.
export function ChampsSalarie({ fiche, lectureSeule }: { fiche?: FicheSalarie; lectureSeule?: boolean }) {
  const d = lectureSeule;
  return (
    <>
      <TitreGroupe>Identité</TitreGroupe>
      <Champ nom="matricule" libelle="Matricule" requis valeurInitiale={fiche?.matricule} desactive={d} />
      <Champ nom="nom" libelle="Nom" requis valeurInitiale={fiche?.nom} desactive={d} />
      <Champ nom="prenoms" libelle="Prénoms" requis valeurInitiale={fiche?.prenoms} desactive={d} />
      <ChoixListe
        nom="sexe"
        libelle="Sexe"
        valeurInitiale={fiche?.sexe ?? ""}
        desactive={d}
        options={[
          { valeur: "F", libelle: "Féminin" },
          { valeur: "M", libelle: "Masculin" },
        ]}
      />
      <Champ nom="date_naissance" libelle="Date de naissance" type="date" valeurInitiale={fiche?.date_naissance} desactive={d} />
      <Champ nom="nationalite" libelle="Nationalité" valeurInitiale={fiche?.nationalite} desactive={d} />

      <TitreGroupe>Emploi</TitreGroupe>
      <Champ nom="poste" libelle="Poste" valeurInitiale={fiche?.poste} desactive={d} />
      <Champ nom="date_embauche" libelle="Date d'embauche" type="date" requis valeurInitiale={fiche?.date_embauche} desactive={d} />
      <Champ nom="numero_cnss" libelle="N° CNSS" valeurInitiale={fiche?.numero_cnss} desactive={d} />

      <TitreGroupe>Contact</TitreGroupe>
      <Champ
        nom="telephone"
        libelle="Téléphone"
        type="tel"
        valeurInitiale={fiche?.telephone}
        desactive={d}
        aide="Servira à la connexion au portail salarié. Format : +241 77 12 34 56."
      />
      <Champ nom="email" libelle="Email" type="email" valeurInitiale={fiche?.email} desactive={d} />
      <Champ nom="adresse" libelle="Adresse" pleineLargeur valeurInitiale={fiche?.adresse} desactive={d} />

      <TitreGroupe>Paiement du salaire</TitreGroupe>
      <Champ nom="banque" libelle="Banque" valeurInitiale={fiche?.banque} desactive={d} />
      <Champ nom="numero_compte" libelle="N° de compte (RIB)" valeurInitiale={fiche?.numero_compte} desactive={d} />
    </>
  );
}
