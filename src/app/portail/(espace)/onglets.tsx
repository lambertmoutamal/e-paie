"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, MessagesSquare } from "lucide-react";

const ONGLETS = [
  { href: "/portail", libelle: "Bulletins", icone: FileText },
  { href: "/portail/absences", libelle: "Absences", icone: CalendarDays },
  { href: "/portail/reclamations", libelle: "Réclamations", icone: MessagesSquare },
];

// Onglets de l'espace salarié (grands boutons, faciles à toucher sur téléphone).
// « enBas » : barre fixe en bas de l'écran (téléphone), onglets de 56 px avec icône au-dessus du texte.
export function OngletsPortail({ enBas = false }: { enBas?: boolean }) {
  const chemin = usePathname();
  return (
    <nav
      aria-label="Mon espace"
      className={
        enBas
          ? "fixed inset-x-0 bottom-0 z-20 flex border-t border-bordure bg-surface pb-[env(safe-area-inset-bottom)] shadow-flottant"
          : "mx-auto flex w-full max-w-3xl gap-1 px-4"
      }
    >
      {ONGLETS.map(({ href, libelle, icone: Icone }) => {
        const actif = href === "/portail" ? chemin === "/portail" || chemin.startsWith("/portail/bulletins") : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={
              enBas
                ? `flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                    actif ? "bg-marque-claire text-marque-fonce" : "text-doux hover:text-foreground"
                  }`
                : `-mb-px inline-flex h-11 flex-1 items-center justify-center gap-2 border-b-2 text-sm font-medium sm:flex-none sm:px-5 ${
                    actif ? "border-marque text-marque" : "border-transparent text-doux hover:text-foreground"
                  }`
            }
          >
            <Icone size={enBas ? 22 : 16} aria-hidden />
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
