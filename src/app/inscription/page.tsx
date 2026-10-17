import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CadreAuth } from "@/components/cadre-auth";
import { CircleCheck } from "lucide-react";
import { CaseACocher, Champ, ChoixCartes, Formulaire } from "@/components/formulaire";
import { DUREE_ESSAI_JOURS } from "@/lib/abonnements/tarifs";
import { inscrire } from "./actions";

export const metadata: Metadata = { title: "Créer un compte" };

export default function PageInscription({ searchParams }: PageProps<"/inscription">) {
  return (
    <CadreAuth
      titre="Créer votre compte"
      description="30 jours d'essai gratuit, sans engagement et sans moyen de paiement."
      pied={
        <>
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-medium text-marque hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <FormulaireInscription searchParams={searchParams} />
      </Suspense>
    </CadreAuth>
  );
}

async function FormulaireInscription({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { formule, type } = await searchParams;

  return (
    <Formulaire action={inscrire} libelleBouton="Créer mon compte">
      <ChoixCartes
        nom="type"
        libelle="Vous êtes"
        valeurInitiale={type === "entreprise" ? "entreprise" : type === "cabinet" ? "cabinet" : undefined}
        options={[
          { valeur: "cabinet", titre: "Un cabinet comptable", texte: "Je gère la paie de plusieurs entreprises clientes." },
          { valeur: "entreprise", titre: "Une entreprise", texte: "Je fais la paie de ma propre entreprise." },
        ]}
      />
      <ChoixCartes
        nom="formule"
        libelle="Formule"
        valeurInitiale={formule === "pro" ? "pro" : "essai"}
        options={[
          { valeur: "essai", titre: "Essai gratuit", texte: "30 jours pour tout découvrir." },
          { valeur: "pro", titre: "Pro", texte: "Essai de 30 jours, puis abonnement : nous vous contactons." },
        ]}
      />
      <Champ nom="nom_structure" libelle="Nom du cabinet ou de l'entreprise" requis />
      <Champ nom="nom_complet" libelle="Votre nom complet" autoComplete="name" requis />
      <Champ nom="email" libelle="Votre email professionnel" type="email" autoComplete="email" requis />
      <div className="rounded-xl border border-marque/20 bg-marque-claire/60 p-4 sm:col-span-2">
        <p className="font-semibold text-marque-nuit">Votre essai gratuit</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-marque-nuit">
          {[`${DUREE_ESSAI_JOURS} jours d'accès complet`, "Sans engagement", "Sans moyen de paiement : rien à payer pendant l'essai"].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CircleCheck size={16} className="mt-0.5 shrink-0 text-marque" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <CaseACocher nom="conditions">
        J&apos;accepte les{" "}
        <Link href="/conditions" target="_blank" className="font-medium text-marque underline">
          conditions d&apos;utilisation
        </Link>
        .
      </CaseACocher>
    </Formulaire>
  );
}
