import type { Metadata } from "next";
import Link from "next/link";
import { CadreAuth } from "@/components/cadre-auth";
import { Champ, Formulaire } from "@/components/formulaire";
import { demanderReinitialisation } from "./actions";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <CadreAuth
      titre="Mot de passe oublié"
      description="Indiquez votre email : vous recevrez un lien pour choisir un nouveau mot de passe."
      pied={
        <Link href="/connexion" className="font-medium text-marque hover:underline">
          ← Retour à la connexion
        </Link>
      }
    >
      <Formulaire action={demanderReinitialisation} libelleBouton="Recevoir le lien">
        <Champ nom="email" libelle="Email" type="email" autoComplete="email" requis />
      </Formulaire>
    </CadreAuth>
  );
}
