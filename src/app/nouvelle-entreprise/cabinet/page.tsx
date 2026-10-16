import type { Metadata } from "next";
import Link from "next/link";
import { CadreAuth } from "@/components/cadre-auth";
import { Champ, Formulaire } from "@/components/formulaire";
import { ChampsEntreprise } from "@/app/espace/entreprises/champs-entreprise";
import { creerEntrepriseDepuisConnexion } from "./actions";

export const metadata: Metadata = { title: "Ajouter une entreprise cliente" };

// Cabinet déjà inscrit : ajout d'une entreprise cliente (identifiants du cabinet requis),
// depuis la page de connexion et non dans l'espace.
export default function PageNouvelleEntreprise() {
  return (
    <CadreAuth
      titre="Ajouter une entreprise cliente"
      description="Cabinet comptable déjà inscrit : identifiez-vous, puis renseignez l'entreprise cliente à ajouter."
      pied={
        <div className="flex flex-col gap-3">
          <p>
            Vous êtes une entreprise ?{" "}
            <Link href="/nouvelle-entreprise" className="font-medium text-marque hover:underline">
              Créer votre entreprise
            </Link>
          </p>
          <p>
            <Link href="/connexion" className="font-medium text-marque hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </div>
      }
    >
      <Formulaire action={creerEntrepriseDepuisConnexion} libelleBouton="Créer l'entreprise" colonnes={2}>
        <p className="sm:col-span-2 text-sm font-bold uppercase tracking-wide text-doux">Vos identifiants</p>
        <Champ nom="email" libelle="Email" type="email" autoComplete="email" requis />
        <Champ nom="mot_de_passe" libelle="Mot de passe" type="password" autoComplete="current-password" requis />
        <Champ nom="cabinet" libelle="Nom du cabinet" aide="Seulement si vous gérez plusieurs cabinets." pleineLargeur />
        <p className="sm:col-span-2 mt-2 text-sm font-bold uppercase tracking-wide text-doux">L&apos;entreprise</p>
        <ChampsEntreprise />
      </Formulaire>
    </CadreAuth>
  );
}
