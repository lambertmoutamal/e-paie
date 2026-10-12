import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { Squelette } from "@/components/ui";
import { deconnecterSalarie } from "../connexion/actions";
import { OngletsPortail } from "./onglets";

// Espace du salarié : mise en page simple, pensée d'abord pour le téléphone.
export default function MiseEnPagePortail({ children }: LayoutProps<"/portail">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-bordure bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/portail" aria-label="Mes bulletins">
            <Logo taille={28} />
          </Link>
          <form action={deconnecterSalarie}>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-doux hover:bg-black/[.04] hover:text-foreground">
              <LogOut size={16} aria-hidden />
              Déconnexion
            </button>
          </form>
        </div>
        {/* Les onglets lisent l'adresse de la page : ils s'affichent dès qu'elle est connue */}
        <Suspense fallback={<div className="h-11" aria-hidden />}>
          <OngletsPortail />
        </Suspense>
      </header>
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto w-full max-w-3xl">
          <Suspense fallback={<Squelette />}>{children}</Suspense>
        </div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-doux">DématPaie · vos bulletins, toujours disponibles</footer>
    </div>
  );
}
