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
  LayoutDashboard,
  LayoutGrid,
  Receipt,
  Smartphone,
  UserRound,
} from "lucide-react";

const ICONES = {
  tableau: LayoutDashboard,
  cabinets: Building2,
  entreprises: Briefcase,
  modules: LayoutGrid,
  abonnement: CreditCard,
  profil: UserRound,
  administration: FileText,
  bulletins: FolderLock,
  absences: CalendarDays,
  "self-service": Smartphone,
  "notes-de-frais": Receipt,
  pilotage: BarChart3,
  paie: Calculator,
};

export type ElementMenu = { href: string; libelle: string; icone: keyof typeof ICONES; bientot?: boolean };
export type GroupeMenu = { titre: string; elements: ElementMenu[] };

function estActif(chemin: string, href: string) {
  return href === "/espace" ? chemin === "/espace" : chemin === href || chemin.startsWith(`${href}/`);
}

// Menu latéral (ordinateur), organisé en rubriques
export function MenuLateral({ groupes }: { groupes: GroupeMenu[] }) {
  const chemin = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {groupes.map((groupe) => (
        <div key={groupe.titre}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-doux/80">{groupe.titre}</p>
          <ul className="flex flex-col gap-0.5">
            {groupe.elements.map((e) => {
              const Icone = ICONES[e.icone];
              const actif = estActif(chemin, e.href);
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    aria-current={actif ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                      actif
                        ? "bg-marque-claire text-marque"
                        : e.bientot
                          ? "text-doux/70 hover:bg-black/[.03]"
                          : "text-doux hover:bg-black/[.03] hover:text-foreground"
                    }`}
                  >
                    <Icone size={18} aria-hidden />
                    <span className="flex-1 truncate">{e.libelle}</span>
                    {e.bientot && (
                      <span className="rounded-full bg-black/[.05] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-doux">
                        Bientôt
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
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
