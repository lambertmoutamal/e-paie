import Link from "next/link";
import { ArrowRight, Briefcase, FileCheck2, ShieldCheck, Smartphone, UserRound, Workflow } from "lucide-react";
import { Logo } from "@/components/logo";
import { classesBouton } from "@/components/ui";

const ATOUTS = [
  { icone: FileCheck2, titre: "Zéro papier", texte: "Bulletins déposés, validés et distribués en ligne, archivés durablement." },
  { icone: Workflow, titre: "Circuit de validation", texte: "Contrôle, approbation et publication, avec séparation des tâches." },
  { icone: ShieldCheck, titre: "Sécurité", texte: "Chaque entreprise dans un espace isolé, chaque action tracée." },
  { icone: Smartphone, titre: "Pensé pour le téléphone", texte: "Léger, utilisable même avec une connexion faible." },
];

export default function Accueil() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-bordure bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Logo />
          <Link href="/connexion" className={classesBouton("secondaire", "petit")}>
            Se connecter
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-marque text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Plateforme de paie en ligne</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">La paie zéro papier</h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">
              Pour les cabinets comptables et les entreprises : bulletins, congés et échanges avec les
              salariés, au même endroit, depuis le téléphone.
            </p>
          </div>
        </section>

        <section className="mx-auto -mt-8 grid max-w-6xl gap-4 px-4 sm:grid-cols-2">
          <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
            <span className="grid size-11 place-items-center rounded-lg bg-marque-claire text-marque">
              <UserRound size={22} aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Espace salarié</h2>
            <p className="mt-1 text-sm text-doux">Consultez vos bulletins, demandez un congé ou déposez une réclamation.</p>
            <p className="mt-4 inline-flex rounded-full bg-black/[.05] px-3 py-1 text-xs font-medium text-doux">
              Disponible prochainement
            </p>
          </div>
          <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
            <span className="grid size-11 place-items-center rounded-lg bg-marque-claire text-marque">
              <Briefcase size={22} aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Espace cabinet / entreprise</h2>
            <p className="mt-1 text-sm text-doux">Gérez vos entreprises, vos salariés et la publication des bulletins.</p>
            <Link href="/connexion" className={`${classesBouton("principal")} mt-4`}>
              Se connecter
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {ATOUTS.map(({ icone: Icone, titre, texte }) => (
            <div key={titre}>
              <Icone size={22} className="text-marque" aria-hidden />
              <h3 className="mt-3 font-semibold">{titre}</h3>
              <p className="mt-1 text-sm text-doux">{texte}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-bordure py-6 text-center text-xs text-doux">e-Paie · La paie zéro papier</footer>
    </div>
  );
}
