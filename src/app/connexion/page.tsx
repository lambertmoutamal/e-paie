import type { Metadata } from "next";
import Link from "next/link";
import { CadreAuth } from "@/components/cadre-auth";
import { seConnecter } from "./actions";
import { FormulaireConnexion } from "./formulaire-connexion";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <CadreAuth
      titre="Connexion"
      description="Espace cabinet et entreprise. Connectez-vous avec l'email fourni par votre administrateur."
      pied={
        <div className="flex flex-col gap-3">
          <p>
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="font-medium text-marque hover:underline">
              Essayer gratuitement 30 jours
            </Link>
          </p>
          <p>Vous êtes salarié ? L&apos;espace salarié, avec connexion par téléphone, arrive bientôt.</p>
        </div>
      }
    >
      <FormulaireConnexion action={seConnecter} />
      <p className="mt-4 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="font-medium text-marque hover:underline">
          Mot de passe oublié ?
        </Link>
      </p>
    </CadreAuth>
  );
}
