import Link from "next/link";
import type { ReactNode } from "react";
import { FileLock2, Layers, Smartphone } from "lucide-react";
import { Logo } from "./logo";

const ATOUTS = [
  { icone: Layers, titre: "Données isolées par entreprise", texte: "Chaque entreprise ne voit que ses propres données, et chaque action est tracée." },
  { icone: FileLock2, titre: "Bulletins verrouillés", texte: "Une fois publié, un bulletin est verrouillé et porte une empreinte qui permet de détecter toute modification." },
  { icone: Smartphone, titre: "Portail salarié sur téléphone", texte: "Les salariés consultent leurs bulletins depuis leur téléphone, avec un simple code." },
];

// Mise en page des écrans de connexion : panneau de marque à gauche (ordinateur),
// formulaire centré à droite.
export function CadreAuth({ titre, description, children, pied }: { titre: string; description?: string; children: ReactNode; pied?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-marque-nuit via-marque-fonce to-marque p-10 text-white lg:flex xl:p-14">
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-white/5" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5" />
        <Link href="/" className="relative w-fit rounded-lg">
          <Logo clair />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-balance text-3xl font-bold leading-tight xl:text-4xl">La paie zéro papier, du cabinet jusqu&apos;au téléphone du salarié.</h2>
          <ul className="mt-10 flex flex-col gap-6">
            {ATOUTS.map(({ icone: Icone, titre, texte }) => (
              <li key={titre} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
                  <Icone size={20} aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{titre}</p>
                  <p className="mt-0.5 text-sm text-white/85">{texte}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/75">© DématPaie</p>
      </aside>

      <main className="flex flex-col items-center justify-center bg-background px-4 py-8 sm:py-10">
        <div className="w-full max-w-sm rounded-2xl border border-bordure bg-surface p-6 shadow-carte sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <Link href="/" aria-label="DématPaie, accueil" className="mb-6 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{titre}</h1>
          {description && <p className="mt-2 text-doux">{description}</p>}
          <div className="mt-6">{children}</div>
          {pied && <div className="mt-8 text-sm text-doux">{pied}</div>}
        </div>
      </main>
    </div>
  );
}
