import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { droitsUtilisateur } from "@/lib/auth/utilisateur";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, EnTetePage, LienBouton, Page } from "@/components/ui";
import { modifierProfil } from "./actions";

export const metadata: Metadata = { title: "Mon profil" };

export default async function PageProfil() {
  const { profil } = await droitsUtilisateur();

  return (
    <Page>
      <EnTetePage titre="Mon profil" description="Vos informations personnelles." fil={[{ href: "/espace", libelle: "Tableau de bord" }]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="Informations">
          <Formulaire action={modifierProfil} libelleBouton="Enregistrer">
            <Champ nom="nom_complet" libelle="Nom complet" requis valeurInitiale={profil?.nom_complet} />
            <Champ
              nom="email"
              libelle="Email"
              type="email"
              valeurInitiale={profil?.email}
              desactive
              aide="L'email ne peut être changé que par un administrateur."
            />
          </Formulaire>
        </Carte>
        <Carte titre="Sécurité" description="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs.">
          <LienBouton href="/espace/mot-de-passe" variante="secondaire" icone={KeyRound}>
            Changer mon mot de passe
          </LienBouton>
        </Carte>
      </div>
    </Page>
  );
}
