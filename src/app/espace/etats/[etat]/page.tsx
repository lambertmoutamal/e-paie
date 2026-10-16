import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileBarChart2, Info, Printer } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libellePeriode } from "@/lib/bulletins/regles";
import { etatParCode } from "@/lib/etats/catalogue";
import { chargerEtat } from "@/lib/etats/donnees";
import { exigerEntrepriseCourante } from "@/lib/entreprise-courante";
import { Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { BoutonsExport } from "../boutons-export";

export const metadata: Metadata = { title: "État" };

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export default async function PageEtat({
  params,
  searchParams,
}: PageProps<"/espace/etats/[etat]">) {
  const { etat: code } = await params;
  const definition = etatParCode(code);
  if (!definition) notFound();
  const { mois: choixMois, annee: choixAnnee } = await searchParams;
  const { supabase } = await exigerUtilisateur();
  // Une seule entreprise à la fois : celle choisie à la connexion
  const entreprise = await exigerEntrepriseCourante();

  const maintenant = new Date();
  const moisValide =
    typeof choixMois === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(choixMois);
  const anneeValide =
    typeof choixAnnee === "string" && /^20\d{2}$/.test(choixAnnee);
  // Les états annuels (DTS, DAS) portent par défaut sur l'année écoulée
  const anneeParDefaut = definition.parAnnee
    ? maintenant.getUTCFullYear() - 1
    : maintenant.getUTCFullYear();
  const annee = definition.parAnnee
    ? anneeValide
      ? Number(choixAnnee)
      : anneeParDefaut
    : moisValide
      ? Number(choixMois.slice(0, 4))
      : maintenant.getUTCFullYear();
  const mois = moisValide
    ? Number(choixMois.slice(5, 7))
    : maintenant.getUTCMonth() + 1;
  const valeurMois = `${annee}-${String(mois).padStart(2, "0")}`;
  const annees = Array.from(
    { length: 6 },
    (_, i) => maintenant.getUTCFullYear() - i,
  );
  const periodeAffichee = definition.parMois
    ? libellePeriode(annee, mois)
    : definition.parAnnee
      ? `Année ${annee}`
      : "";

  const resultat =
    definition.disponible && entreprise
      ? await chargerEtat(supabase, definition.code, entreprise.id, annee, mois)
      : null;
  const titreComplet = `${definition.titre}${periodeAffichee ? ` — ${periodeAffichee}` : ""}${entreprise ? ` — ${entreprise.raison_sociale}` : ""}`;

  return (
    <Page>
      <Link
        href="/espace/etats"
        className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline print:hidden"
      >
        <ChevronLeft size={16} aria-hidden />
        Tous les états
      </Link>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {definition.titre}
          </h1>
          <p className="text-doux">
            {entreprise?.raison_sociale}
            {periodeAffichee ? ` · ${periodeAffichee}` : ""}
          </p>
        </div>
        {resultat && (
          <BoutonsExport
            nomFichier={`${definition.code}-${definition.parAnnee ? annee : valeurMois}`}
            titre={titreComplet}
            colonnes={resultat.colonnes}
            lignes={resultat.lignes}
            total={resultat.total}
          />
        )}
      </header>

      {/* Filtres */}
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-bordure bg-surface p-4 print:hidden">
        {definition.parMois && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Mois
            <input
              type="month"
              name="mois"
              defaultValue={valeurMois}
              className="h-11 rounded-lg border border-bordure bg-surface px-3 text-base"
            />
          </label>
        )}
        {definition.parAnnee && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Année
            <select
              name="annee"
              defaultValue={annee}
              className="h-11 rounded-lg border border-bordure bg-surface px-3 text-base"
            >
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className={classesBouton()}>
          Afficher
        </button>
      </form>

      {!definition.disponible ? (
        <Carte>
          <EtatVide
            icone={FileBarChart2}
            titre="Bientôt disponible"
            texte="Cet état sera produit à partir de l'import mensuel des résultats de paie (prochaine étape)."
          />
        </Carte>
      ) : !resultat ? (
        <Carte>
          <EtatVide
            icone={FileBarChart2}
            titre="Aucune entreprise accessible"
          />
        </Carte>
      ) : (
        <>
          {resultat.remarque && (
            <p className="flex items-start gap-2 rounded-lg border border-bordure bg-marque-claire/50 px-3 py-2 text-sm text-marque-nuit print:hidden">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
              {resultat.remarque}
            </p>
          )}
          <Carte
            titre={titreComplet}
            description={`${resultat.lignes.length} ligne(s)`}
            sansMarge
          >
            {!resultat.lignes.length ? (
              <EtatVide
                icone={FileBarChart2}
                titre="Aucune donnée pour cette sélection"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-marque-claire/60 text-left text-xs uppercase tracking-wide text-marque-fonce">
                    <tr>
                      {resultat.colonnes.map((c) => (
                        <th
                          key={c.cle}
                          scope="col"
                          className={`whitespace-nowrap px-4 py-2.5 font-semibold ${c.nombre ? "text-right" : ""}`}
                        >
                          {c.libelle}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure">
                    {resultat.lignes.map((l, i) => (
                      <tr key={i} className="even:bg-black/[.015]">
                        {resultat.colonnes.map((c) => (
                          <td
                            key={c.cle}
                            className={`px-4 py-2 ${c.nombre ? "text-right tabular-nums" : ""} ${c.cle === "empreinte" ? "font-mono text-[11px]" : ""}`}
                          >
                            {typeof l[c.cle] === "number"
                              ? NOMBRE.format(l[c.cle] as number)
                              : l[c.cle]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {resultat.total && (
                    <tfoot className="border-t-2 border-bordure bg-black/[.02] font-semibold">
                      <tr>
                        {resultat.colonnes.map((c) => (
                          <td
                            key={c.cle}
                            className={`px-4 py-2.5 ${c.nombre ? "text-right tabular-nums" : ""}`}
                          >
                            {typeof resultat.total![c.cle] === "number"
                              ? NOMBRE.format(resultat.total![c.cle] as number)
                              : (resultat.total![c.cle] ?? "")}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Carte>
          {!!resultat.liens?.length && (
            <div className="print:hidden">
              <Carte titre="Documents à imprimer">
                <ul className="flex flex-col gap-2">
                  {resultat.liens.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex items-center gap-2 text-sm font-medium text-marque hover:underline"
                      >
                        <Printer size={16} aria-hidden />
                        {l.libelle}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Carte>
            </div>
          )}
        </>
      )}
      <p className="hidden text-xs text-doux print:block">
        Édité avec DématPaie le {maintenant.toLocaleDateString("fr-FR")}.
      </p>
    </Page>
  );
}
