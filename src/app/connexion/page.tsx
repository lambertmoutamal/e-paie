import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { CadreAuth } from "@/components/cadre-auth";
import { classesBouton } from "@/components/ui";
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
          <p>
            Vous êtes salarié ?{" "}
            <Link href="/portail/connexion" className="font-medium text-marque hover:underline">
              Connexion par téléphone
            </Link>
          </p>
        </div>
      }
    >
      <FormulaireConnexion action={seConnecter} />
      <p className="mt-4 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="font-medium text-marque hover:underline">
          Mot de passe oublié ?
        </Link>
      </p>
      {/* Les entreprises s'ajoutent ici, jamais depuis l'espace connecté */}
      <div className="mt-6 border-t border-bordure pt-6">
        <Link href="/nouvelle-entreprise" className={`${classesBouton("secondaire")} w-full`}>
          <Building2 size={16} aria-hidden />
          Créer une nouvelle entreprise
        </Link>
        <p className="mt-2 text-center text-xs text-doux">Pour les cabinets comptables déjà inscrits.</p>
      </div>
    </CadreAuth>
  );
}
