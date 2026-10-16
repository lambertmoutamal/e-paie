import type { Metadata } from "next";
import Link from "next/link";
import { CadreAuth } from "@/components/cadre-auth";
import { FormulairePortail } from "./formulaire-portail";
import { BoutonInstallation } from "../application";

export const metadata: Metadata = { title: "Espace salarié" };

export default function PageConnexionSalarie() {
  return (
    <CadreAuth
      titre="Espace salarié"
      description="Consultez et téléchargez vos bulletins de paie. Pas de mot de passe : un code vous est envoyé sur votre téléphone."
      pied={
        <p>
          Vous êtes un cabinet ou un employeur ?{" "}
          <Link href="/connexion" className="font-medium text-marque hover:underline">
            Connexion par email
          </Link>
        </p>
      }
    >
      <FormulairePortail />
      <div className="mt-6">
        <BoutonInstallation />
      </div>
    </CadreAuth>
  );
}
