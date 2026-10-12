import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileBarChart2 } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libellePeriode } from "@/lib/bulletins/regles";
import { etatParCode } from "@/lib/etats/catalogue";
import { chargerEtat } from "@/lib/etats/donnees";
import { entrepriseCourante, entreprisesAccessibles } from "@/lib/entreprise-courante";
import { Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { BoutonsExport } from "../boutons-export";

export const metadata: Metadata = { title: "État" };

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export default async function PageEtat({ params, searchParams }: PageProps<"/espace/etats/[etat]">) {
  const { etat: code } = await params;
  const definition = etatParCode(code);
  if (!definition) notFound();
  const { entreprise: choixEntreprise, mois: choixMois } = await searchParams;
  const { supabase } = await exigerUtilisateur();
  const [liste, courante] = await Promise.all([entreprisesAccessibles(), entrepriseCourante()]);
  const entreprise = liste.find((e) => e.id === choixEntreprise) ?? courante ?? liste[0] ?? null;

  const maintenant = new Date();
  const moisValide = typeof choixMois === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(choixMois);
  const annee = moisValide ? Number(choixMois.slice(0, 4)) : maintenant.getUTCFullYear();
  const mois = moisValide ? Number(choixMois.slice(5, 7)) : maintenant.getUTCMonth() + 1;
  const valeurMois = `${annee}-${String(mois).padStart(2, "0")}`;

  const resultat = definition.disponible && entreprise ? await chargerEtat(supabase, definition.code, entreprise.id, annee, mois) : null;
  const titreComplet = `${definition.titre}${definition.parMois ? ` — ${libellePeriode(annee, mois)}` : ""}${entreprise ? ` — ${entreprise.raison_sociale}` : ""}`;

  return (
    <Page>
      <Link href="/espace/etats" className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline print:hidden">
        <ChevronLeft size={16} aria-hidden />
        Tous les états
      </Link>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{definition.titre}</h1>
          <p className="text-doux">
            {entreprise?.raison_sociale}
            {definition.parMois ? ` · ${libellePeriode(annee, mois)}` : ""}
          </p>
        </div>
        {resultat && <BoutonsExport nomFichier={`${definition.code}-${valeurMois}`} titre={titreComplet} colonnes={resultat.colonnes} lignes={resultat.lignes} total={resultat.total} />}
      </header>

      {/* Filtres */}
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-bordure bg-surface p-4 print:hidden">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">
          Entreprise
          <select name="entreprise" defaultValue={entreprise?.id} className="h-11 rounded-lg border border-bordure bg-surface px-3 text-base">
            {liste.map((e) => (
              <option key={e.id} value={e.id}>
                {e.raison_sociale}
              </option>
            ))}
          </select>
        </label>
        {definition.parMois && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Mois
            <input type="month" name="mois" defaultValue={valeurMois} className="h-11 rounded-lg border border-bordure bg-surface px-3 text-base" />
          </label>
        )}
        <button type="submit" className={classesBouton()}>
          Afficher
        </button>
      </form>

      {!definition.disponible ? (
        <Carte>
          <EtatVide icone={FileBarChart2} titre="Bientôt disponible" texte="Cet état sera produit à partir de l'import mensuel des résultats de paie (prochaine étape)." />
        </Carte>
      ) : !resultat ? (
        <Carte>
          <EtatVide icone={FileBarChart2} titre="Aucune entreprise accessible" />
        </Carte>
      ) : (
        <Carte titre={titreComplet} description={`${resultat.lignes.length} ligne(s)`} sansMarge>
          {!resultat.lignes.length ? (
            <EtatVide icone={FileBarChart2} titre="Aucune donnée pour cette sélection" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-marque-claire/60 text-left text-xs uppercase tracking-wide text-marque-fonce">
                  <tr>
                    {resultat.colonnes.map((c) => (
                      <th key={c.cle} scope="col" className={`whitespace-nowrap px-4 py-2.5 font-semibold ${c.nombre ? "text-right" : ""}`}>
                        {c.libelle}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bordure">
                  {resultat.lignes.map((l, i) => (
                    <tr key={i} className="even:bg-black/[.015]">
                      {resultat.colonnes.map((c) => (
                        <td key={c.cle} className={`px-4 py-2 ${c.nombre ? "text-right tabular-nums" : ""} ${c.cle === "empreinte" ? "font-mono text-[11px]" : ""}`}>
                          {typeof l[c.cle] === "number" ? NOMBRE.format(l[c.cle] as number) : l[c.cle]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {resultat.total && (
                  <tfoot className="border-t-2 border-bordure bg-black/[.02] font-semibold">
                    <tr>
                      {resultat.colonnes.map((c) => (
                        <td key={c.cle} className={`px-4 py-2.5 ${c.nombre ? "text-right tabular-nums" : ""}`}>
                          {typeof resultat.total![c.cle] === "number" ? NOMBRE.format(resultat.total![c.cle] as number) : (resultat.total![c.cle] ?? "")}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Carte>
      )}
      <p className="hidden text-xs text-doux print:block">Édité avec DématPaie le {maintenant.toLocaleDateString("fr-FR")}.</p>
    </Page>
  );
}
