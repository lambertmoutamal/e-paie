"use client";

import { useState, useTransition } from "react";
import { Building2, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { choisirEntrepriseEtContinuer } from "../espace/actions-navigation";

// Teintes assez foncées pour un texte blanc lisible (contraste 4,5:1)
const COULEURS = ["bg-indigo-600", "bg-rose-600", "bg-emerald-700", "bg-amber-700", "bg-sky-700", "bg-violet-600", "bg-orange-700", "bg-teal-700"];

// Deux lettres : initiales des deux premiers mots de la raison sociale
function initiales(nom: string) {
  const mots = nom.split(/[\s\-']+/).filter((m) => /\p{L}/u.test(m));
  return mots
    .slice(0, 2)
    .map((m) => Array.from(m)[0].toUpperCase())
    .join("");
}

// Liste des entreprises à choisir, avec recherche quand elles sont nombreuses.
export function ListeChoixEntreprises({ entreprises }: { entreprises: { id: string; raison_sociale: string; interne_cabinet: boolean; effectif: number }[] }) {
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
            className="h-12 w-full rounded-full border border-bordure bg-surface pl-11 pr-4 text-base shadow-carte outline-none placeholder:text-doux/70 focus:border-marque focus:ring-2 focus:ring-marque/20"
          />
        </label>
      )}
      {visibles.length === 0 && (
        <p role="status" className="rounded-2xl border border-dashed border-bordure bg-surface px-4 py-8 text-center text-doux">
          Aucune entreprise ne correspond à « {filtre.trim()} ». Essayez un autre nom.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {visibles.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={enCours}
              onClick={() => choisir(e.id)}
              className="group flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-2xl border border-bordure bg-surface p-4 text-left shadow-carte transition motion-safe:hover:-translate-y-0.5 hover:border-marque/40 hover:shadow-survol disabled:cursor-wait disabled:opacity-60"
            >
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-base font-bold tracking-wide text-white ${e.interne_cabinet ? "bg-marque" : COULEURS[i % COULEURS.length]}`}>
                {e.interne_cabinet ? <Building2 size={22} aria-hidden /> : initiales(e.raison_sociale) || <Building2 size={22} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">{e.raison_sociale}</span>
                <span className="block text-sm text-doux">
                  {e.interne_cabinet && "Mon cabinet · "}
                  {e.effectif} salarié{e.effectif > 1 ? "s" : ""} en poste
                </span>
              </span>
              {enCours && choix === e.id ? (
                <LoaderCircle size={18} className="animate-spin text-marque" aria-hidden />
              ) : (
                <ChevronRight size={20} className="text-doux transition group-hover:translate-x-0.5 group-hover:text-marque" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
