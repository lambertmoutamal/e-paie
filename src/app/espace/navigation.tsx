"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { GroupeMenu, TacheMenu } from "@/lib/menu";

// Toutes les tâches d'un groupe (y compris celles des sections)
function tachesDuGroupe(g: GroupeMenu): TacheMenu[] {
  return [...g.taches, ...(g.sections?.flatMap((s) => s.taches) ?? [])];
}

// Le groupe contient-il la page affichée ? (pour le mettre en évidence)
function groupeActif(g: GroupeMenu, chemin: string): boolean {
  return tachesDuGroupe(g).some((t) => !t.bientot && t.href !== "/choix-entreprise" && (chemin === t.href || chemin.startsWith(`${t.href}/`)));
}

// Menus déroulants de la barre du haut (ordinateur) : un groupe = une liste de tâches.
export function MenuGroupes({ groupes }: { groupes: GroupeMenu[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const zone = useRef<HTMLUListElement>(null);
  const chemin = usePathname();

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
      {groupes.map((g) => {
        const estOuvert = ouvert === g.id;
        const actif = groupeActif(g, chemin);
        return (
          <li key={g.id} className="relative">
            <button
              type="button"
              aria-expanded={estOuvert}
              aria-haspopup="true"
              data-actif={actif || undefined}
              onClick={() => setOuvert(estOuvert ? null : g.id)}
              className={`relative inline-flex h-11 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition ${
                estOuvert
                  ? "bg-white text-marque-fonce"
                  : actif
                    ? "bg-white/15 text-white after:absolute after:inset-x-4 after:bottom-1 after:h-0.5 after:rounded-full after:bg-white"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g.libelle}
              <ChevronDown size={15} className={`transition ${estOuvert ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {estOuvert && (
              <div
                className={`absolute left-0 top-12 z-30 overflow-hidden rounded-2xl border border-bordure bg-surface p-2 text-foreground shadow-flottant ${
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
            <span className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-doux">
              {t.libelle}
              <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-[11px] font-semibold uppercase">Bientôt</span>
            </span>
          ) : (
            <Link href={t.href} onClick={fermer} className="block min-h-11 rounded-xl px-3 py-2 transition-colors hover:bg-marque-claire">
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
      <button type="button" onClick={() => { setOuvert(true); setCheminOuverture(chemin); }} className="grid size-11 place-items-center rounded-full hover:bg-white/10 lg:hidden" aria-label="Ouvrir le menu">
        <Menu size={21} aria-hidden />
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-16 items-center justify-between border-b border-bordure bg-surface px-4">
            <span className="text-lg font-bold">Menu</span>
            <button type="button" onClick={() => setOuvert(false)} className="grid size-11 place-items-center rounded-full hover:bg-black/[.05]" aria-label="Fermer le menu">
              <X size={21} aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {groupes.map((g) => (
              <details key={g.id} open={groupeActif(g, chemin) || undefined} className="group mb-2 overflow-hidden rounded-2xl border border-bordure bg-surface shadow-carte">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
                  <span className="flex items-center gap-2">
                    {g.libelle}
                    {groupeActif(g, chemin) && <span className="size-2 rounded-full bg-marque" aria-label="Section de la page affichée" />}
                  </span>
                  <ChevronDown size={18} className="transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-bordure p-1">
                  <ListeTaches taches={tachesDuGroupe(g)} fermer={() => setOuvert(false)} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
