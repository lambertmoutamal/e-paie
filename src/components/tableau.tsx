import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// Tableau adaptatif des listes de l'espace : vrai tableau à partir de 640 px (en-têtes collants),
// cartes empilées en dessous, sans aucun défilement horizontal.

export type Colonne<T> = {
  cle: string;
  titre: string;
  rendu: (ligne: T) => ReactNode;
  // Colonne principale : devient le titre de la carte sur téléphone
  principale?: boolean;
  // Colonne de statut : affichée sans libellé, en bas de la carte sur téléphone
  statut?: boolean;
  // Ne pas afficher sur téléphone
  masquerSurTelephone?: boolean;
};

export function Tableau<T>({
  colonnes,
  lignes,
  cleLigne,
  hrefLigne,
  legende,
}: {
  colonnes: Colonne<T>[];
  lignes: T[];
  cleLigne: (ligne: T) => string;
  hrefLigne?: (ligne: T) => string;
  // Titre du tableau pour les lecteurs d'écran
  legende: string;
}) {
  const principale = colonnes.find((c) => c.principale) ?? colonnes[0];
  const secondaires = colonnes.filter((c) => c !== principale && !c.statut && !c.masquerSurTelephone);
  const statut = colonnes.find((c) => c.statut);

  return (
    <>
      {/* Téléphone : cartes empilées */}
      <ul className="flex flex-col gap-2.5 sm:hidden" aria-label={legende}>
        {lignes.map((l) => {
          const href = hrefLigne?.(l);
          const contenu = (
            <>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 break-words font-semibold">{principale.rendu(l)}</div>
                {href && <ChevronRight size={20} className="mt-0.5 shrink-0 text-doux" aria-hidden />}
              </div>
              {secondaires.length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {secondaires.map((c) => (
                    <div key={c.cle} className="contents">
                      <dt className="text-doux">{c.titre}</dt>
                      <dd className="min-w-0 break-words">{c.rendu(l) || "–"}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {statut && <div className="mt-2.5">{statut.rendu(l)}</div>}
            </>
          );
          const classes = "block min-h-14 rounded-2xl border border-bordure bg-surface p-4 shadow-carte";
          return (
            <li key={cleLigne(l)}>
              {href ? (
                <Link href={href} className={`${classes} transition-colors hover:border-marque/40 hover:bg-marque-claire/40`}>
                  {contenu}
                </Link>
              ) : (
                <div className={classes}>{contenu}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Ordinateur : tableau, en-têtes collants pendant le défilement de la page */}
      <div className="hidden rounded-2xl border border-bordure bg-surface shadow-carte sm:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{legende}</caption>
          <thead>
            <tr>
              {colonnes.map((c) => (
                <th
                  key={c.cle}
                  scope="col"
                  className="sticky top-0 z-10 border-b border-bordure bg-background px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-doux first:rounded-tl-2xl last:rounded-tr-2xl"
                >
                  {c.titre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const href = hrefLigne?.(l);
              return (
                <tr key={cleLigne(l)} className="group transition-colors hover:bg-marque-claire/40">
                  {colonnes.map((c) => (
                    <td key={c.cle} className="break-words border-b border-bordure px-4 py-3 align-middle group-last:border-b-0">
                      {c === principale && href ? (
                        <Link href={href} className="inline-block min-h-6 font-semibold text-foreground hover:text-marque hover:underline">
                          {c.rendu(l)}
                        </Link>
                      ) : (
                        c.rendu(l)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Pastilles de filtre rapide : de simples liens (paramètre d'URL), accessibles au clavier.
export function Pastilles({ libelle, elements }: { libelle: string; elements: { href: string; libelle: string; actif: boolean; nombre?: number }[] }) {
  return (
    <nav aria-label={libelle} className="flex flex-wrap gap-2">
      {elements.map((e) => (
        <Link
          key={e.libelle}
          href={e.href}
          aria-current={e.actif ? "true" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
            e.actif ? "border-marque bg-marque text-white" : "border-bordure bg-surface text-foreground hover:border-marque/40 hover:bg-marque-claire/60"
          }`}
        >
          {e.libelle}
          {e.nombre !== undefined && (
            <span className={`rounded-full px-2 text-xs tabular-nums ${e.actif ? "bg-white/20" : "bg-black/[.06] text-doux"}`}>{e.nombre}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
