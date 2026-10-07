import Link from "next/link";
import type { ReactNode } from "react";
import { FileCheck2, ShieldCheck, Smartphone } from "lucide-react";
import { Logo } from "./logo";

const ATOUTS = [
  { icone: FileCheck2, texte: "Bulletins de paie dématérialisés et archivés" },
  { icone: ShieldCheck, texte: "Données isolées par entreprise, actions tracées" },
  { icone: Smartphone, texte: "Accès des salariés depuis leur téléphone" },
];

// Mise en page des écrans de connexion : panneau de marque à gauche (ordinateur),
// formulaire centré à droite.
export function CadreAuth({ titre, description, children, pied }: { titre: string; description?: string; children: ReactNode; pied?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-marque p-10 text-white lg:flex">
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-white/5" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5" />
        <Link href="/" className="relative">
          <Logo clair />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight">La paie zéro papier pour les cabinets et entreprises du Gabon.</h2>
          <ul className="mt-8 flex flex-col gap-4">
            {ATOUTS.map(({ icone: Icone, texte }) => (
              <li key={texte} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 place-items-center rounded-lg bg-white/10">
                  <Icone size={18} aria-hidden />
                </span>
                {texte}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">© e-Paie · Libreville</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{titre}</h1>
          {description && <p className="mt-2 text-doux">{description}</p>}
          <div className="mt-8">{children}</div>
          {pied && <div className="mt-8 text-sm text-doux">{pied}</div>}
        </div>
      </main>
    </div>
  );
}
