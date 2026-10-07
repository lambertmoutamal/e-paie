"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, CreditCard, LayoutDashboard, UserRound } from "lucide-react";

const ICONES = { tableau: LayoutDashboard, cabinets: Building2, entreprises: Briefcase, abonnement: CreditCard, profil: UserRound };

export type ElementMenu = { href: string; libelle: string; icone: keyof typeof ICONES };

function estActif(chemin: string, href: string) {
  return href === "/espace" ? chemin === "/espace" : chemin.startsWith(href);
}

// Menu latéral (ordinateur)
export function MenuLateral({ elements }: { elements: ElementMenu[] }) {
  const chemin = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {elements.map((e) => {
        const Icone = ICONES[e.icone];
        const actif = estActif(chemin, e.href);
        return (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={actif ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                actif ? "bg-marque-claire text-marque" : "text-doux hover:bg-black/[.03] hover:text-foreground"
              }`}
            >
              <Icone size={18} aria-hidden />
              {e.libelle}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Barre d'onglets en bas de l'écran (téléphone)
export function BarreOnglets({ elements }: { elements: ElementMenu[] }) {
  const chemin = usePathname();
  return (
    <ul className="grid" style={{ gridTemplateColumns: `repeat(${elements.length}, minmax(0, 1fr))` }}>
      {elements.map((e) => {
        const Icone = ICONES[e.icone];
        const actif = estActif(chemin, e.href);
        return (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={actif ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${actif ? "text-marque" : "text-doux"}`}
            >
              <Icone size={20} aria-hidden />
              {e.libelle}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
