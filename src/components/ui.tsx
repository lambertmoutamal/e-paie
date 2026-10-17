import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

// Briques d'interface communes à tout l'espace privé.

type Variante = "principal" | "secondaire" | "discret" | "danger";

export function classesBouton(variante: Variante = "principal", taille: "normal" | "petit" = "normal") {
  const base =
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,box-shadow,color] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";
  const tailles = { normal: "h-11 px-4 text-sm", petit: "h-11 px-3 text-sm sm:h-9" };
  const variantes: Record<Variante, string> = {
    principal: "bg-marque text-white shadow-sm hover:bg-marque-fonce hover:shadow-survol",
    secondaire: "border border-bordure bg-surface text-foreground shadow-sm hover:border-marque/30 hover:bg-marque-claire/60",
    discret: "text-marque hover:bg-marque-claire",
    danger: "border border-red-200 bg-surface text-red-700 hover:border-red-300 hover:bg-red-50",
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
                <Link href={f.href} className="inline-flex min-h-8 items-center rounded font-medium hover:text-marque hover:underline">
                  {f.libelle}
                </Link>
                <ChevronRight size={14} aria-hidden />
              </span>
            ))}
          </nav>
        )}
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-[1.75rem] sm:leading-9">{titre}</h1>
        {description && <p className="mt-1 max-w-2xl text-doux">{description}</p>}
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
    <section className="overflow-hidden rounded-2xl border border-bordure bg-surface shadow-carte">
      {(titre || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-bordure px-4 py-3.5 sm:px-5">
          <div>
            {titre && <h2 className="text-base font-semibold tracking-tight">{titre}</h2>}
            {description && <p className="mt-0.5 text-sm text-doux">{description}</p>}
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
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marque-claire text-marque">
          <Icone size={18} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{titre}</p>
        {sousTitre && <div className="truncate text-sm text-doux">{sousTitre}</div>}
      </div>
      {fin && <div className="flex shrink-0 items-center gap-2">{fin}</div>}
      {href && <ChevronRight size={18} className="shrink-0 text-doux transition-transform group-hover/ligne:translate-x-0.5 group-hover/ligne:text-marque" aria-hidden />}
    </>
  );
  const classes = "flex min-h-14 items-center gap-3 px-4 py-3 sm:px-5";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${classes} group/ligne transition-colors hover:bg-marque-claire/50 focus-visible:-outline-offset-2`}>
          {contenu}
        </Link>
      ) : (
        <div className={classes}>{contenu}</div>
      )}
    </li>
  );
}

const TEINTES = {
  vert: "bg-marque-claire text-marque-fonce ring-marque/15",
  succes: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  gris: "bg-black/[.05] text-doux ring-black/5",
  ambre: "bg-amber-50 text-amber-800 ring-amber-600/20",
  rouge: "bg-red-50 text-red-700 ring-red-600/20",
  bleu: "bg-sky-50 text-sky-800 ring-sky-600/20",
};

export function Badge({ teinte = "gris", children }: { teinte?: keyof typeof TEINTES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TEINTES[teinte]}`}>
      {children}
    </span>
  );
}

export function EtatVide({ icone: Icone, titre, texte, action }: { icone: LucideIcon; titre: string; texte?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-marque-claire/70 ring-8 ring-marque-claire/40">
        <span className="grid size-11 place-items-center rounded-full bg-surface text-marque shadow-carte">
          <Icone size={22} aria-hidden />
        </span>
      </span>
      <p className="mt-2 text-base font-semibold">{titre}</p>
      {texte && <p className="max-w-sm text-sm text-doux">{texte}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const TEINTES_STAT = {
  indigo: "bg-indigo-50 text-indigo-600",
  vert: "bg-emerald-50 text-emerald-600",
  corail: "bg-accent-claire text-accent",
  ambre: "bg-amber-50 text-amber-600",
  ciel: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
};

export function Statistique({
  icone: Icone,
  libelle,
  valeur,
  href,
  detail,
  teinte = "indigo",
}: {
  icone: LucideIcon;
  libelle: string;
  valeur: number | string;
  href?: string;
  // Précision courte sous le libellé
  detail?: string;
  teinte?: keyof typeof TEINTES_STAT;
}) {
  const contenu = (
    <>
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${TEINTES_STAT[teinte]}`}>
        <Icone size={21} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-tight">{valeur}</p>
        <p className="truncate text-sm font-medium text-doux">{libelle}</p>
        {detail && <p className="truncate text-xs text-doux">{detail}</p>}
      </div>
    </>
  );
  const classes = "flex items-center gap-3 rounded-2xl border border-bordure bg-surface p-4 shadow-carte";
  return href ? (
    <Link href={href} className={`${classes} transition motion-safe:hover:-translate-y-0.5 hover:border-marque/30 hover:shadow-survol`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

export function Squelette({ lignes = 3 }: { lignes?: number }) {
  return (
    <div className="flex flex-col gap-3 motion-safe:animate-pulse" role="status" aria-busy="true" aria-label="Chargement">
      <div className="h-7 w-48 rounded-lg bg-black/[.06]" />
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-black/[.04]" />
      ))}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
