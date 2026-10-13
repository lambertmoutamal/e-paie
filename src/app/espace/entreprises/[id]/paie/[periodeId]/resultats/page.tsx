import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock, Trash2 } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libellePeriode } from "@/lib/bulletins/regles";
import { champLie } from "@/lib/supabase/relations";
import { Carte, classesBouton, EnTetePage, LienBouton, Page } from "@/components/ui";
import { ImportResultats } from "./import-resultats";
import { supprimerResultats } from "./actions";

export const metadata: Metadata = { title: "Résultats de paie" };

const MONTANT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const COLONNES = [
  { cle: "brut", libelle: "Brut" },
  { cle: "cnss_salarie", libelle: "CNSS sal." },
  { cle: "cnamgs_salarie", libelle: "CNAMGS sal." },
  { cle: "impot_revenu", libelle: "IRPP / ITS" },
  { cle: "net_a_payer", libelle: "Net à payer" },
] as const;

export default async function PageResultats({ params }: PageProps<"/espace/entreprises/[id]/paie/[periodeId]/resultats">) {
  const { id, periodeId } = await params;
  const { supabase } = await exigerUtilisateur();
  const [{ data: entreprise }, { data: periode }, { data: salaries }, { data: resultats }, { data: peutDeposer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.from("periodes_paie").select("annee, mois, statut").eq("id", periodeId).eq("entreprise_id", id).maybeSingle(),
    supabase.from("salaries").select("id, matricule").eq("entreprise_id", id),
    supabase
      .from("resultats_paie")
      .select("id, brut, cnss_salarie, cnamgs_salarie, impot_revenu, net_a_payer, rubriques, salaries(matricule, nom, prenoms)")
      .eq("periode_id", periodeId)
      .order("importe_le"),
    supabase.rpc("peut_deposer_bulletins", { p_entreprise_id: id }),
  ]);
  if (!entreprise || !periode) notFound();
  const modifiable = peutDeposer === true && periode.statut === "brouillon";
  const titre = libellePeriode(periode.annee, periode.mois);
  const total = (cle: (typeof COLONNES)[number]["cle"]) => (resultats ?? []).reduce((s, r) => s + Number(r[cle] ?? 0), 0);

  return (
    <Page>
      <EnTetePage
        titre={`Résultats de paie · ${titre}`}
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}/paie`, libelle: "Paie et bulletins" },
          { href: `/espace/entreprises/${id}/paie/${periodeId}`, libelle: titre },
        ]}
        actions={
          <LienBouton href={`/espace/etats/livre-de-paie?entreprise=${id}&mois=${periode.annee}-${String(periode.mois).padStart(2, "0")}`} variante="secondaire">
            Livre de paie
          </LienBouton>
        }
      />

      {modifiable ? (
        <Carte
          titre="Importer l'Excel du logiciel de paie"
          description="Les montants alimentent le livre de paie, les soldes de tout compte, la DTS et la DAS. Un nouvel import remplace les lignes des mêmes salariés."
        >
          <ImportResultats entrepriseId={id} periodeId={periodeId} salaries={salaries ?? []} />
        </Carte>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-doux">
          <Lock size={16} aria-hidden />
          {periode.statut === "brouillon" ? "Vous ne pouvez pas importer de résultats pour cette entreprise." : "Période verrouillée : les résultats ne peuvent plus être modifiés."}
        </p>
      )}

      <Carte
        titre={`${resultats?.length ?? 0} salarié(s) importé(s)`}
        action={
          modifiable && !!resultats?.length ? (
            <form action={supprimerResultats.bind(null, id, periodeId)}>
              <button type="submit" className={classesBouton("danger", "petit")}>
                <Trash2 size={14} aria-hidden />
                Tout supprimer
              </button>
            </form>
          ) : undefined
        }
        sansMarge
      >
        {!!resultats?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-marque-claire/60 text-left text-xs uppercase tracking-wide text-marque-fonce">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Salarié</th>
                  {COLONNES.map((c) => (
                    <th key={c.cle} className="px-4 py-2.5 text-right font-semibold">
                      {c.libelle}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">Rubriques</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {resultats.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      {champLie(r.salaries, "nom")} {champLie(r.salaries, "prenoms")} <span className="text-doux">· {champLie(r.salaries, "matricule")}</span>
                    </td>
                    {COLONNES.map((c) => (
                      <td key={c.cle} className="px-4 py-2 text-right tabular-nums">
                        {r[c.cle] === null ? "—" : MONTANT.format(Number(r[c.cle]))}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-doux">{Object.keys(r.rubriques ?? {}).length}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-bordure bg-black/[.02] font-semibold">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  {COLONNES.map((c) => (
                    <td key={c.cle} className="px-4 py-2.5 text-right tabular-nums">
                      {MONTANT.format(total(c.cle))}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Carte>
    </Page>
  );
}
