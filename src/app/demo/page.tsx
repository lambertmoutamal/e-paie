import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck, CircleCheck, Clock, Video } from "lucide-react";
import { Champ, ChoixListe, Formulaire, ZoneTexte } from "@/components/formulaire";
import { PagePublique } from "@/components/vitrine";
import { demanderDemo } from "./actions";

export const metadata: Metadata = {
  title: "Demander une démo",
  description: "Découvrez DématPaie lors d'une démonstration de 30 minutes adaptée à votre organisation.",
};

const AVANTAGES = [
  { icone: Clock, texte: "30 minutes, à l'heure qui vous convient" },
  { icone: Video, texte: "En ligne, depuis votre ordinateur ou votre téléphone" },
  { icone: CalendarCheck, texte: "Adaptée à vos cas : nombre d'entreprises, de salariés, circuit de validation" },
  { icone: CircleCheck, texte: "Sans engagement" },
];

export default function PageDemo({ searchParams }: PageProps<"/demo">) {
  return (
    <PagePublique>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-marque">Démonstration</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Voyez DématPaie en action</h1>
          <p className="mt-4 text-lg text-doux">
            Un membre de notre équipe vous présente la plateforme et répond à vos questions, sur la base de votre organisation.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {AVANTAGES.map(({ icone: Icone, texte }) => (
              <li key={texte} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marque-claire text-marque">
                  <Icone size={18} aria-hidden />
                </span>
                <span className="pt-1.5">{texte}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-bordure bg-surface p-6 shadow-sm">
          <Suspense fallback={null}>
            <FormulaireDemo searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </PagePublique>
  );
}

async function FormulaireDemo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { type } = await searchParams;
  return (
    <Formulaire action={demanderDemo} libelleBouton="Envoyer ma demande" colonnes={2}>
      <Champ nom="nom" libelle="Votre nom" autoComplete="name" requis />
      <Champ nom="structure" libelle="Cabinet ou entreprise" autoComplete="organization" requis />
      <ChoixListe
        nom="type"
        libelle="Vous êtes"
        requis
        valeurInitiale={type === "cabinet" || type === "entreprise" ? type : undefined}
        options={[
          { valeur: "cabinet", libelle: "Un cabinet comptable" },
          { valeur: "entreprise", libelle: "Une entreprise" },
          { valeur: "autre", libelle: "Autre" },
        ]}
      />
      <ChoixListe
        nom="effectif"
        libelle="Nombre de salariés gérés"
        options={[
          { valeur: "moins de 20", libelle: "Moins de 20" },
          { valeur: "20 à 100", libelle: "20 à 100" },
          { valeur: "100 à 500", libelle: "100 à 500" },
          { valeur: "plus de 500", libelle: "Plus de 500" },
        ]}
      />
      <Champ nom="email" libelle="Email professionnel" type="email" autoComplete="email" requis />
      <Champ nom="telephone" libelle="Téléphone" type="tel" autoComplete="tel" />
      <ZoneTexte nom="message" libelle="Votre besoin (facultatif)" />

      {/* Piège à robots : caché aux humains et aux lecteurs d'écran */}
      <input type="text" name="site_web" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
    </Formulaire>
  );
}
