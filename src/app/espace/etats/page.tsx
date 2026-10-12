import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, FileBarChart2, Landmark, Receipt, Users } from "lucide-react";
import { ETATS } from "@/lib/etats/catalogue";
import { Page } from "@/components/ui";

export const metadata: Metadata = { title: "États" };

const GROUPES = [
  { nom: "Personnel", icone: Users, couleur: "bg-sky-50 text-sky-600" },
  { nom: "Congés et absences", icone: CalendarDays, couleur: "bg-emerald-50 text-emerald-600" },
  { nom: "Paie", icone: Receipt, couleur: "bg-indigo-50 text-indigo-600" },
  { nom: "Déclarations", icone: Landmark, couleur: "bg-amber-50 text-amber-600" },
] as const;

export default function PageEtats() {
  return (
    <Page>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">États</h1>
        <p className="text-doux">Choisissez un état : il se calcule pour l&apos;entreprise et le mois voulus, puis s&apos;exporte en Excel ou en PDF.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {GROUPES.map((g) => (
          <section key={g.nom} className="rounded-2xl border border-bordure bg-surface p-4 shadow-[0_1px_3px_rgba(27,30,46,.05)]">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <span className={`grid size-9 place-items-center rounded-xl ${g.couleur}`}>
                <g.icone size={18} aria-hidden />
              </span>
              {g.nom}
            </h2>
            <ul className="flex flex-col gap-1">
              {ETATS.filter((e) => e.groupe === g.nom).map((e) =>
                e.disponible ? (
                  <li key={e.code}>
                    <Link href={`/espace/etats/${e.code}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-marque-claire">
                      <FileBarChart2 size={17} className="shrink-0 text-marque" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{e.titre}</span>
                        <span className="block text-xs text-doux">{e.description}</span>
                      </span>
                      <ChevronRight size={16} className="text-doux" aria-hidden />
                    </Link>
                  </li>
                ) : (
                  <li key={e.code} className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-70">
                    <FileBarChart2 size={17} className="shrink-0 text-doux" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{e.titre}</span>
                      <span className="block text-xs text-doux">{e.description} Nécessite l&apos;import mensuel des résultats de paie.</span>
                    </span>
                    <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-[10px] font-semibold uppercase text-doux">Bientôt</span>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
