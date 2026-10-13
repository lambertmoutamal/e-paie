"use client";

import { useState, useTransition } from "react";
import { Briefcase, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { choisirEntrepriseEtContinuer } from "../actions-navigation";

const COULEURS = ["bg-indigo-500", "bg-rose-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-violet-500", "bg-orange-500", "bg-teal-500"];

// Liste des entreprises à choisir, avec recherche quand elles sont nombreuses.
export function ListeChoixEntreprises({ entreprises }: { entreprises: { id: string; raison_sociale: string; effectif: number }[] }) {
  const [filtre, setFiltre] = useState("");
  const [choix, setChoix] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const visibles = entreprises.filter((e) => e.raison_sociale.toLowerCase().includes(filtre.trim().toLowerCase()));
  const choisir = (id: string) => {
    setChoix(id);
    demarrer(() => choisirEntrepriseEtContinuer(id));
  };

  return (
    <div className="flex flex-col gap-4">
      {entreprises.length > 6 && (
        <label className="relative">
          <span className="sr-only">Rechercher une entreprise</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-doux" aria-hidden />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            autoFocus
            placeholder="Rechercher une entreprise…"
            className="h-12 w-full rounded-full border border-bordure bg-surface pl-11 pr-4 text-base shadow-sm outline-none focus:border-marque focus:ring-2 focus:ring-marque/20"
          />
        </label>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {visibles.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={enCours}
              onClick={() => choisir(e.id)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-bordure bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-marque/40 hover:shadow-md disabled:opacity-60"
            >
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-white ${COULEURS[i % COULEURS.length]}`}>
                <Briefcase size={22} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.raison_sociale}</span>
                <span className="block text-sm text-doux">
                  {e.effectif} salarié{e.effectif > 1 ? "s" : ""} en poste
                </span>
              </span>
              {enCours && choix === e.id ? (
                <LoaderCircle size={18} className="animate-spin text-marque" aria-hidden />
              ) : (
                <ChevronRight size={18} className="text-doux transition group-hover:translate-x-0.5" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
