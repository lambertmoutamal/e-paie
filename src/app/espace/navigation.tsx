"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Briefcase, ChevronDown, LoaderCircle, Menu, X } from "lucide-react";
import type { GroupeMenu, TacheMenu } from "@/lib/menu";
import { choisirEntreprise } from "./actions-navigation";

// Menus déroulants de la barre du haut (ordinateur) : un groupe = une liste de tâches.
export function MenuGroupes({ groupes }: { groupes: GroupeMenu[] }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const zone = useRef<HTMLUListElement>(null);

  // Fermeture : clic en dehors, touche Échap
  useEffect(() => {
    const clic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(null);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", echap);
    };
  }, []);

  return (
    <ul ref={zone} className="flex items-center gap-0.5">
      <li>
        <Link
          href="/espace"
          className={`inline-flex h-10 items-center rounded-full px-3.5 text-sm font-semibold transition ${chemin === "/espace" ? "bg-white text-marque-fonce" : "text-white/85 hover:bg-white/10 hover:text-white"}`}
        >
          Tableau de bord
        </Link>
      </li>
      {groupes.map((g) => {
        const estOuvert = ouvert === g.id;
        return (
          <li key={g.id} className="relative">
            <button
              type="button"
              aria-expanded={estOuvert}
              aria-haspopup="true"
              onClick={() => setOuvert(estOuvert ? null : g.id)}
              className={`inline-flex h-10 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition ${
                estOuvert ? "bg-white text-marque-fonce" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g.libelle}
              <ChevronDown size={15} className={`transition ${estOuvert ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {estOuvert && (
              <div
                className={`absolute left-0 top-12 z-30 overflow-hidden rounded-2xl border border-bordure bg-surface p-2 text-foreground shadow-2xl ${
                  g.sections ? "w-[min(46rem,90vw)]" : "w-80"
                }`}
              >
                <ListeTaches taches={g.taches} fermer={() => setOuvert(null)} />
                {g.sections && (
                  <div className="mt-1 grid gap-2 border-t border-bordure pt-2 sm:grid-cols-2">
                    {g.sections.map((s) => (
                      <div key={s.titre}>
                        <p className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-doux">{s.titre}</p>
                        <ListeTaches taches={s.taches} fermer={() => setOuvert(null)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListeTaches({ taches, fermer }: { taches: TacheMenu[]; fermer: () => void }) {
  return (
    <ul className="flex flex-col">
      {taches.map((t) => (
        <li key={`${t.libelle}-${t.href}`}>
          {t.bientot ? (
            <span className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-doux">
              {t.libelle}
              <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-[10px] font-semibold uppercase">Bientôt</span>
            </span>
          ) : (
            <Link href={t.href} onClick={fermer} className="block rounded-xl px-3 py-2 hover:bg-marque-claire">
              <span className="block text-sm font-semibold">{t.libelle}</span>
              {t.description && <span className="block text-xs text-doux">{t.description}</span>}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

// Menu complet sur téléphone : un bouton ouvre la liste des groupes.
export function MenuMobile({ groupes }: { groupes: GroupeMenu[] }) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();
  const [cheminOuverture, setCheminOuverture] = useState(chemin);
  // Changement de page : le menu se referme
  if (ouvert && chemin !== cheminOuverture) {
    setOuvert(false);
    setCheminOuverture(chemin);
  }
  return (
    <>
      <button type="button" onClick={() => { setOuvert(true); setCheminOuverture(chemin); }} className="grid size-10 place-items-center rounded-full hover:bg-white/10 lg:hidden" aria-label="Ouvrir le menu">
        <Menu size={21} aria-hidden />
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-40 flex flex-col bg-surface text-foreground lg:hidden" role="dialog" aria-label="Menu">
          <div className="flex h-16 items-center justify-between border-b border-bordure px-4">
            <span className="font-bold">Menu</span>
            <button type="button" onClick={() => setOuvert(false)} className="grid size-10 place-items-center rounded-full hover:bg-black/[.05]" aria-label="Fermer le menu">
              <X size={21} aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <Link href="/espace" className="mb-2 block rounded-xl bg-marque-claire px-4 py-3 font-semibold text-marque-fonce">
              Tableau de bord
            </Link>
            {groupes.map((g) => (
              <details key={g.id} className="mb-2 rounded-xl border border-bordure">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
                  {g.libelle}
                  <ChevronDown size={16} aria-hidden />
                </summary>
                <div className="border-t border-bordure p-1">
                  <ListeTaches taches={[...g.taches, ...(g.sections?.flatMap((s) => s.taches) ?? [])]} fermer={() => setOuvert(false)} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Choix de l'entreprise de travail, toujours visible dans la barre du haut.
export function SelecteurEntreprise({ entreprises, courante }: { entreprises: { id: string; raison_sociale: string }[]; courante: string | null }) {
  const [enCours, demarrer] = useTransition();
  if (entreprises.length === 0) return null;
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Entreprise de travail</span>
      {enCours ? (
        <LoaderCircle size={15} className="pointer-events-none absolute left-3 animate-spin text-white/80" aria-hidden />
      ) : (
        <Briefcase size={15} className="pointer-events-none absolute left-3 text-white/80" aria-hidden />
      )}
      <select
        value={courante ?? ""}
        disabled={enCours}
        onChange={(ev) => demarrer(() => choisirEntreprise(ev.target.value))}
        className="h-10 max-w-48 cursor-pointer appearance-none truncate rounded-full border border-white/25 bg-white/10 pl-9 pr-8 text-sm font-semibold text-white outline-none hover:bg-white/15 focus:ring-2 focus:ring-white/40 sm:max-w-60"
      >
        <option value="" className="text-foreground">
          Choisir une entreprise…
        </option>
        {entreprises.map((e) => (
          <option key={e.id} value={e.id} className="text-foreground">
            {e.raison_sociale}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-white/80" aria-hidden />
    </label>
  );
}
