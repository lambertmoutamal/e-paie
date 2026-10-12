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
export function OngletsPortail() {
  const chemin = usePathname();
  return (
    <nav aria-label="Mon espace" className="mx-auto flex w-full max-w-3xl gap-1 px-4">
      {ONGLETS.map(({ href, libelle, icone: Icone }) => {
        const actif = href === "/portail" ? chemin === "/portail" || chemin.startsWith("/portail/bulletins") : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={`-mb-px inline-flex h-11 flex-1 items-center justify-center gap-2 border-b-2 text-sm font-medium sm:flex-none sm:px-5 ${
              actif ? "border-marque text-marque" : "border-transparent text-doux hover:text-foreground"
            }`}
          >
            <Icone size={16} aria-hidden />
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
