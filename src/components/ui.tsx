import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

// Briques d'interface communes à tout l'espace privé.

type Variante = "principal" | "secondaire" | "discret" | "danger";

export function classesBouton(variante: Variante = "principal", taille: "normal" | "petit" = "normal") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const tailles = { normal: "h-11 px-4 text-sm", petit: "h-9 px-3 text-sm" };
  const variantes: Record<Variante, string> = {
    principal: "bg-marque text-white hover:bg-marque-fonce",
    secondaire: "border border-bordure bg-surface text-foreground hover:bg-black/[.03]",
    discret: "text-marque hover:bg-marque-claire",
    danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
  };
  return `${base} ${tailles[taille]} ${variantes[variante]}`;
}

export function LienBouton({
  variante,
  taille,
  icone: Icone,
  children,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; taille?: "normal" | "petit"; icone?: LucideIcon }) {
  return (
    <Link className={classesBouton(variante, taille)} {...props}>
      {Icone && <Icone size={16} aria-hidden />}
      {children}
    </Link>
  );
}

export function EnTetePage({
  titre,
  description,
  fil,
  actions,
}: {
  titre: string;
  description?: string;
  fil?: { href: string; libelle: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {fil && fil.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-doux">
            {fil.map((f) => (
              <span key={f.href} className="inline-flex items-center gap-1">
                <Link href={f.href} className="hover:text-marque">
                  {f.libelle}
                </Link>
                <ChevronRight size={14} aria-hidden />
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight">{titre}</h1>
        {description && <p className="mt-1 text-doux">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Carte({
  titre,
  description,
  action,
  children,
  sansMarge,
}: {
  titre?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  sansMarge?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-bordure bg-surface shadow-[0_1px_2px_rgba(16,24,20,.04)]">
      {(titre || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-bordure px-4 py-3 sm:px-5">
          <div>
            {titre && <h2 className="font-semibold">{titre}</h2>}
            {description && <p className="text-sm text-doux">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={sansMarge ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function ListeLignes({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-bordure">{children}</ul>;
}

// Ligne de liste : cliquable si « href » est fourni.
export function Ligne({
  href,
  titre,
  sousTitre,
  icone: Icone,
  fin,
}: {
  href?: string;
  titre: ReactNode;
  sousTitre?: ReactNode;
  icone?: LucideIcon;
  fin?: ReactNode;
}) {
  const contenu = (
    <>
      {Icone && (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marque-claire text-marque">
          <Icone size={18} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{titre}</p>
        {sousTitre && <div className="truncate text-sm text-doux">{sousTitre}</div>}
      </div>
      {fin && <div className="flex shrink-0 items-center gap-2">{fin}</div>}
      {href && <ChevronRight size={18} className="shrink-0 text-doux" aria-hidden />}
    </>
  );
  const classes = "flex items-center gap-3 px-4 py-3 sm:px-5";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${classes} hover:bg-black/[.02]`}>
          {contenu}
        </Link>
      ) : (
        <div className={classes}>{contenu}</div>
      )}
    </li>
  );
}

const TEINTES = {
  vert: "bg-marque-claire text-marque",
  gris: "bg-black/[.05] text-doux",
  ambre: "bg-amber-50 text-amber-800",
  rouge: "bg-red-50 text-red-700",
  bleu: "bg-sky-50 text-sky-800",
};

export function Badge({ teinte = "gris", children }: { teinte?: keyof typeof TEINTES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TEINTES[teinte]}`}>
      {children}
    </span>
  );
}

export function EtatVide({ icone: Icone, titre, texte, action }: { icone: LucideIcon; titre: string; texte?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-marque-claire text-marque">
        <Icone size={22} aria-hidden />
      </span>
      <p className="font-semibold">{titre}</p>
      {texte && <p className="max-w-sm text-sm text-doux">{texte}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Statistique({ icone: Icone, libelle, valeur, href }: { icone: LucideIcon; libelle: string; valeur: number | string; href?: string }) {
  const contenu = (
    <>
      <span className="grid size-10 place-items-center rounded-lg bg-marque-claire text-marque">
        <Icone size={20} aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-bold tabular-nums">{valeur}</p>
        <p className="text-sm text-doux">{libelle}</p>
      </div>
    </>
  );
  const classes = "flex items-center gap-3 rounded-xl border border-bordure bg-surface p-4";
  return href ? (
    <Link href={href} className={`${classes} hover:border-marque/40`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

export function Squelette({ lignes = 3 }: { lignes?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-label="Chargement">
      <div className="h-7 w-48 rounded bg-black/[.06]" />
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="h-16 rounded-xl bg-black/[.04]" />
      ))}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
