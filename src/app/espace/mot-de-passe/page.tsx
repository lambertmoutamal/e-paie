import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, EnTetePage, Page } from "@/components/ui";
import { changerMotDePasse } from "../profil/actions";

export const metadata: Metadata = { title: "Mot de passe" };

export default async function PageMotDePasse() {
  const { utilisateur } = await exigerUtilisateur();
  const aDefinir = utilisateur.app_metadata?.mot_de_passe_a_definir === true;

  return (
    <Page>
      <EnTetePage
        titre={aDefinir ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
        description={
          aDefinir
            ? "Dernière étape : choisissez le mot de passe que vous utiliserez pour vous connecter."
            : undefined
        }
        fil={aDefinir ? undefined : [{ href: "/espace/profil", libelle: "Mon profil" }]}
      />
      <div className="max-w-lg">
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
      </div>
    </Page>
  );
}
