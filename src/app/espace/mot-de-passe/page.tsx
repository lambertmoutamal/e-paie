import type { Metadata } from "next";
import { Suspense } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, Chargement, EnTete, PageEspace } from "@/components/mise-en-page";
import { changerMotDePasse } from "../profil/actions";

export const metadata: Metadata = { title: "Mot de passe" };

export default function PageMotDePasse() {
  return (
    <PageEspace>
      <Suspense fallback={<Chargement />}>
        <ContenuMotDePasse />
      </Suspense>
    </PageEspace>
  );
}

async function ContenuMotDePasse() {
  const { utilisateur } = await exigerUtilisateur();
  const provisoire = utilisateur.app_metadata?.mot_de_passe_provisoire === true;

  return (
    <>
      <EnTete
        titre={provisoire ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
        retour={provisoire ? undefined : { href: "/espace/profil", libelle: "Mon profil" }}
        sousTitre={
          provisoire
            ? "Vous vous êtes connecté avec un mot de passe provisoire. Choisissez maintenant votre mot de passe personnel."
            : undefined
        }
      />
      <Carte>
        <Formulaire action={changerMotDePasse} libelleBouton="Enregistrer le mot de passe">
          <Champ
            nom="mot_de_passe"
            libelle="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            requis
            aide="Au moins 10 caractères, avec au moins une lettre et un chiffre."
          />
          <Champ nom="confirmation" libelle="Confirmez le mot de passe" type="password" autoComplete="new-password" requis />
        </Formulaire>
      </Carte>
    </>
  );
}
