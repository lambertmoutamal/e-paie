import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Logo } from "./logo";
import { classesBouton } from "./ui";

// Éléments communs aux pages publiques (site vitrine).

const LIENS = [
  { href: "/#modules", libelle: "Fonctionnalités" },
  { href: "/experts-comptables", libelle: "Experts-comptables" },
  { href: "/#tarifs", libelle: "Tarifs" },
  { href: "/#securite", libelle: "Sécurité" },
  { href: "/#questions", libelle: "Questions" },
];

export function EnTetePublic() {
  return (
    <header className="sticky top-0 z-20 border-b border-bordure bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="DématPaie, accueil">
          <Logo />
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-6 text-sm font-medium text-doux lg:flex">
          {LIENS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.libelle}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/portail/connexion" className={classesBouton("discret", "petit")}>
            Espace salarié
          </Link>
          <Link href="/connexion" className={classesBouton("secondaire", "petit")}>
            Se connecter
          </Link>
          <Link href="/demo" className={classesBouton("principal", "petit")}>
            Demander une démo
          </Link>
        </div>

        {/* Téléphone : « Se connecter » toujours visible, le reste dans le menu (sans JavaScript) */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/connexion" className={classesBouton("secondaire")}>
            Se connecter
          </Link>
          <details className="relative">
            <summary className={`${classesBouton("secondaire")} w-11 cursor-pointer list-none px-0`} aria-label="Ouvrir le menu">
              <Menu size={18} aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 flex w-64 flex-col gap-1 rounded-xl border border-bordure bg-surface p-2 shadow-lg">
              {LIENS.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/[.03]">
                  {l.libelle}
                </Link>
              ))}
              <hr className="my-1 border-bordure" />
              <Link href="/portail/connexion" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/[.03]">
                Espace salarié
              </Link>
              <Link href="/demo" className={`${classesBouton("principal", "petit")} w-full`}>
                Demander une démo
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function PiedPublic() {
  return (
    <footer className="border-t border-bordure bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-doux">La paie zéro papier pour les cabinets comptables et les entreprises.</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Produit</p>
          <Link href="/#modules" className="text-doux hover:text-foreground">Fonctionnalités</Link>
          <Link href="/experts-comptables" className="text-doux hover:text-foreground">Experts-comptables</Link>
          <Link href="/#tarifs" className="text-doux hover:text-foreground">Tarifs</Link>
          <Link href="/#securite" className="text-doux hover:text-foreground">Sécurité</Link>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Contact</p>
          <Link href="/demo" className="text-doux hover:text-foreground">Demander une démo</Link>
          <Link href="/inscription" className="text-doux hover:text-foreground">Essai gratuit d&apos;un mois</Link>
          <Link href="/connexion" className="text-doux hover:text-foreground">Se connecter</Link>
          <Link href="/conditions" className="text-doux hover:text-foreground">Conditions d&apos;utilisation</Link>
        </div>
      </div>
      <p className="border-t border-bordure py-4 text-center text-xs text-doux">© DématPaie</p>
    </footer>
  );
}

export function PagePublique({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <EnTetePublic />
      <main className="flex-1">{children}</main>
      <PiedPublic />
    </div>
  );
}

export function TitreSection({ surtitre, titre, texte, centre }: { surtitre?: string; titre: string; texte?: string; centre?: boolean }) {
  return (
    <div className={`max-w-2xl ${centre ? "mx-auto text-center" : ""}`}>
      {surtitre && <p className="text-sm font-semibold uppercase tracking-wider text-marque">{surtitre}</p>}
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{titre}</h2>
      {texte && <p className="mt-3 text-doux">{texte}</p>}
    </div>
  );
}
