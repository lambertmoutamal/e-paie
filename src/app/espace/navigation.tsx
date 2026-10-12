"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CreditCard,
  FileText,
  FolderLock,
  House,
  Inbox,
  LayoutGrid,
  Receipt,
  Smartphone,
  UserRound,
} from "lucide-react";

const ICONES = {
  tableau: House,
  cabinets: Building2,
  entreprises: Briefcase,
  modules: LayoutGrid,
  abonnement: CreditCard,
  demandes: Inbox,
  profil: UserRound,
  administration: FileText,
  bulletins: FolderLock,
  absences: CalendarDays,
  "self-service": Smartphone,
  "notes-de-frais": Receipt,
  pilotage: BarChart3,
  paie: Calculator,
};

export type ElementMenu = { href: string; libelle: string; icone: keyof typeof ICONES };

function estActif(chemin: string, href: string) {
  return href === "/espace" ? chemin === "/espace" : chemin === href || chemin.startsWith(`${href}/`);
}

// Rubriques principales dans la barre du haut (ordinateur)
export function NavigationHaut({ elements }: { elements: ElementMenu[] }) {
  const chemin = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {elements.map((e) => {
        const actif = estActif(chemin, e.href);
        return (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={actif ? "page" : undefined}
              className={`relative inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition ${
                actif ? "bg-white text-marque-fonce shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
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
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${actif ? "text-marque" : "text-doux"}`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full ${actif ? "bg-marque-claire" : ""}`}>
                <Icone size={19} aria-hidden />
              </span>
              {e.libelle}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
