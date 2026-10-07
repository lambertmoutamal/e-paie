import Link from "next/link";
import type { ReactNode } from "react";

export function PageEspace({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
  );
}

export function EnTete({ titre, retour, sousTitre }: { titre: string; retour?: { href: string; libelle: string }; sousTitre?: string }) {
  return (
    <header className="flex flex-col gap-1">
      {retour && (
        <Link href={retour.href} className="text-sm font-medium text-marque">
          ← {retour.libelle}
        </Link>
      )}
      <h1 className="text-2xl font-bold">{titre}</h1>
      {sousTitre && <p className="text-foreground/70">{sousTitre}</p>}
    </header>
  );
}

export function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{titre}</h2>
      {children}
    </section>
  );
}

export function Carte({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-black/10 bg-white p-4">{children}</div>;
}

export function Chargement() {
  return <p className="text-foreground/60">Chargement…</p>;
}

export function Vide({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-black/20 p-4 text-sm text-foreground/70">
      {children}
    </p>
  );
}
