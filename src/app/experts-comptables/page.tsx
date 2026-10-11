import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, FolderLock, GitBranch, LayoutGrid, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { classesBouton } from "@/components/ui";
import { PagePublique, TitreSection } from "@/components/vitrine";

export const metadata: Metadata = {
  title: "Experts-comptables",
  description: "DématPaie pour les cabinets comptables : gérez la paie de toutes vos entreprises clientes dans des espaces isolés.",
};

const ATOUTS = [
  { icone: LayoutGrid, titre: "Tous vos clients, un seul espace", texte: "Chaque entreprise cliente dispose de son espace isolé. Vous passez de l'une à l'autre en un clic." },
  { icone: Users, titre: "Les bons droits pour chacun", texte: "Gestionnaire de paie, contrôleur, signataire final, RH du client : chacun voit et fait uniquement ce qui le concerne." },
  { icone: GitBranch, titre: "Circuit de validation", texte: "Brouillon, contrôlé, approuvé, publié. Personne ne valide sa propre saisie, et un refus exige un commentaire." },
  { icone: FolderLock, titre: "Distribution sans papier", texte: "Les bulletins publiés arrivent directement dans l'espace de chaque salarié, consultables sur téléphone." },
  { icone: MessageSquare, titre: "Moins d'appels, moins d'emails", texte: "Les salariés de vos clients retrouvent leurs bulletins, font leurs demandes de congé et leurs réclamations en ligne." },
  { icone: ShieldCheck, titre: "Traçabilité pour votre responsabilité", texte: "Journal d'audit infalsifiable : vous savez toujours qui a saisi, validé ou publié quoi, et quand." },
];

const ETAPES = [
  ["Créez votre cabinet", "Inscription en quelques minutes, essai gratuit de 30 jours."],
  ["Ajoutez vos clients", "Une fiche par entreprise cliente, puis import des salariés depuis Excel."],
  ["Invitez les intervenants", "Vos collaborateurs et les RH de vos clients reçoivent une invitation par email."],
  ["Publiez les bulletins", "Dépôt, validation, publication : les salariés sont prévenus automatiquement."],
];

export default function PageExpertsComptables() {
  return (
    <PagePublique>
      <section className="bg-gradient-to-b from-marque-claire/60 to-background">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-marque">Offre cabinets comptables</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Gérez la paie de tous vos clients, sans papier et sans risque de mélange.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-doux">
            DématPaie a été conçu d&apos;abord pour les cabinets : un espace par client, des rôles clairs, un circuit de validation
            et la distribution des bulletins directement aux salariés.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/demo?type=cabinet" className={`${classesBouton("principal")} h-12 px-5`}>
              Demander une démo <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/inscription?type=cabinet" className={`${classesBouton("secondaire")} h-12 px-5`}>
              Essai gratuit 30 jours
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection surtitre="Pourquoi DématPaie" titre="Pensé pour le quotidien d'un cabinet" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ATOUTS.map(({ icone: Icone, titre, texte }) => (
            <div key={titre} className="rounded-xl border border-bordure bg-surface p-5">
              <span className="grid size-11 place-items-center rounded-lg bg-marque-claire text-marque">
                <Icone size={22} aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{titre}</h3>
              <p className="mt-1 text-sm text-doux">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection surtitre="Mise en route" titre="Opérationnel en 4 étapes" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES.map(([titre, texte], i) => (
              <li key={titre} className="rounded-xl border border-bordure p-5">
                <span className="grid size-9 place-items-center rounded-full bg-marque font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{titre}</h3>
                <p className="mt-1 text-sm text-doux">{texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Voyons ensemble comment DématPaie s&apos;adapte à votre cabinet</h2>
        <ul className="mx-auto mt-6 flex max-w-md flex-col gap-2 text-left text-sm">
          {["Démonstration de 30 minutes, en ligne", "Sur vos cas réels : nombre de clients, circuit de validation", "Sans engagement"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CircleCheck size={16} className="text-marque" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        <Link href="/demo?type=cabinet" className={`${classesBouton("principal")} mt-8 h-12 px-6`}>
          Demander une démo
        </Link>
      </section>
    </PagePublique>
  );
}
