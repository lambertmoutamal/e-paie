import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { droitsUtilisateur } from "@/lib/auth/utilisateur";
import { Logo } from "@/components/logo";
import { Squelette } from "@/components/ui";
import { seDeconnecter } from "../connexion/actions";
import { BarreOnglets, MenuLateral, type ElementMenu } from "./navigation";

// Structure commune de l'espace privé. Le cadre s'affiche immédiatement ;
// le menu et le nom de la personne arrivent dès que la session est vérifiée.
export default function MiseEnPageEspace({ children }: LayoutProps<"/espace">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-bordure bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/espace" aria-label="Tableau de bord">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Menu principal" className="flex-1 px-3 py-2">
          <Suspense fallback={null}>
            <Menu variante="lateral" />
          </Suspense>
        </nav>
        <p className="px-5 py-4 text-xs text-doux">La paie zéro papier</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-bordure bg-surface/90 px-4 backdrop-blur lg:px-8">
          <Link href="/espace" className="lg:hidden" aria-label="Tableau de bord">
            <Logo taille={28} />
          </Link>
          <span className="hidden lg:block" />
          <Suspense fallback={null}>
            <MenuUtilisateur />
          </Suspense>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">
            <Suspense fallback={<Squelette />}>{children}</Suspense>
          </div>
        </main>
      </div>

      <nav aria-label="Menu principal" className="fixed inset-x-0 bottom-0 z-10 border-t border-bordure bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Suspense fallback={null}>
          <Menu variante="onglets" />
        </Suspense>
      </nav>
    </div>
  );
}

async function Menu({ variante }: { variante: "lateral" | "onglets" }) {
  const { adminPlateforme, cabinets, affectations } = await droitsUtilisateur();
  const elements: ElementMenu[] = [
    { href: "/espace", libelle: "Tableau de bord", icone: "tableau" },
    ...(adminPlateforme ? [{ href: "/espace/cabinets", libelle: "Cabinets", icone: "cabinets" as const }] : []),
    ...(adminPlateforme || cabinets.length > 0 || affectations.length > 0
      ? [{ href: "/espace/entreprises", libelle: "Entreprises", icone: "entreprises" as const }]
      : []),
    { href: "/espace/profil", libelle: "Mon profil", icone: "profil" },
  ];
  if (variante === "onglets") {
    return <BarreOnglets elements={elements.map((e) => (e.href === "/espace" ? { ...e, libelle: "Accueil" } : e))} />;
  }
  return <MenuLateral elements={elements} />;
}

async function MenuUtilisateur() {
  const { profil } = await droitsUtilisateur();
  const nom: string = profil?.nom_complet || profil?.email || "";
  const initiales = nom
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m: string) => m[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-3">
      <Link href="/espace/profil" className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-marque text-sm font-semibold text-white">
          {initiales}
        </span>
        <span className="hidden max-w-48 truncate text-sm font-medium sm:block">{nom}</span>
      </Link>
      <form action={seDeconnecter}>
        <button
          type="submit"
          className="grid size-9 place-items-center rounded-lg text-doux hover:bg-black/[.04] hover:text-foreground"
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </form>
    </div>
  );
}
