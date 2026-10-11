import type { Metadata } from "next";
import { Info } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { formaterJours, libelleDates } from "@/lib/absences/regles";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, Page } from "@/components/ui";
import { definirSoldeInitial } from "../actions";
import { chargerContexte, EnTeteAbsences } from "../commun";

export const metadata: Metadata = { title: "Soldes de congés" };

type Solde = {
  salarie_id: string;
  date_reference: string;
  solde_initial: number;
  acquis: number;
  anciennete: number;
  pris: number;
  perdu: number;
  en_attente: number;
  disponible: number;
};

export default async function PageSoldes({ params }: PageProps<"/espace/entreprises/[id]/absences/soldes">) {
  const { id } = await params;
  const { supabase, entreprise, peutGerer } = await chargerContexte(id);
  const [{ data: salaries }, { data: soldes }, { data: parametres }, { data: derniers }, { data: initiaux }] = await Promise.all([
    supabase.from("salaries").select("id, matricule, nom, prenoms").eq("entreprise_id", id).eq("statut", "actif").order("nom"),
    supabase.rpc("soldes_entreprise", { p_entreprise_id: id }),
    supabase.from("parametres_conges").select("jours_par_mois, decompte").eq("entreprise_id", id).maybeSingle(),
    supabase.rpc("derniers_conges_entreprise", { p_entreprise_id: id }),
    supabase.from("soldes_conges_initiaux").select("salarie_id, dernier_conge_debut, dernier_conge_fin").eq("entreprise_id", id),
  ]);
  const dernierDe = new Map(((derniers ?? []) as { salarie_id: string; debut: string; fin: string; source: string }[]).map((d) => [d.salarie_id, d]));
  const initialDe = new Map((initiaux ?? []).map((i) => [i.salarie_id, i]));
  const soldeDe = new Map(((soldes ?? []) as Solde[]).map((s) => [s.salarie_id, s]));
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <Page>
      <EnTeteAbsences entrepriseId={id} raisonSociale={entreprise.raison_sociale} onglet="soldes" />

      <p className="flex items-start gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-doux">
        <Info size={16} className="mt-0.5 shrink-0 text-marque" aria-hidden />
        <span>
          Solde = solde de départ + {formaterJours(parametres?.jours_par_mois ?? 2)} acquis par mois complet + jours d&apos;ancienneté − congés pris − jours
          perdus (au-delà du report autorisé). Sans solde saisi, le calcul part de la date d&apos;embauche, avec 0 jour. Ces règles se modifient dans
          l&apos;onglet Réglages.
        </span>
      </p>

      <Carte titre="Soldes de congés payés" sansMarge>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/[.02] text-left text-xs uppercase tracking-wide text-doux">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Salarié</th>
                <th scope="col" className="px-3 py-2 font-semibold">Dernier congé</th>
                <th scope="col" className="px-3 py-2 font-semibold">Départ</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Acquis</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Ancienneté</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Pris</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Perdus</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">En attente</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {(salaries ?? []).map((s) => {
                const solde = soldeDe.get(s.id);
                const dernier = dernierDe.get(s.id);
                const initial = initialDe.get(s.id);
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-2">
                      <p className="font-medium">
                        {s.nom} {s.prenoms}
                      </p>
                      <p className="text-xs text-doux">{s.matricule}</p>
                      {peutGerer && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-marque hover:underline">Modifier le solde de départ</summary>
                          <div className="mt-2 max-w-md">
                            <Formulaire action={definirSoldeInitial.bind(null, s.id)} libelleBouton="Enregistrer" colonnes={2}>
                              <Champ nom="date_reference" libelle="À la date du" type="date" requis valeurInitiale={solde?.date_reference ?? aujourdhui} />
                              <Champ nom="jours" libelle="Jours restants" requis valeurInitiale={String(solde?.solde_initial ?? 0)} aide="Exemple : 12,5" />
                              <Champ nom="dernier_conge_debut" libelle="Dernier congé pris : du" type="date" valeurInitiale={initial?.dernier_conge_debut} aide="Facultatif : congé pris avant DématPaie." />
                              <Champ nom="dernier_conge_fin" libelle="au" type="date" valeurInitiale={initial?.dernier_conge_fin} />
                            </Formulaire>
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {dernier ? (
                        <>
                          {libelleDates(dernier)}
                          <span className="block text-xs text-doux">{dernier.source === "saisie" ? "saisi par le RH" : "enregistré dans DématPaie"}</span>
                        </>
                      ) : (
                        <span className="text-doux">Aucun</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-doux">
                      {solde ? (
                        <>
                          {formaterJours(solde.solde_initial)}
                          <span className="block text-xs">au {formaterDate(solde.date_reference)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{solde ? `+${formaterJours(solde.acquis)}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{solde && Number(solde.anciennete) > 0 ? `+${formaterJours(solde.anciennete)}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{solde ? `−${formaterJours(solde.pris)}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-doux">{solde && Number(solde.perdu) > 0 ? `−${formaterJours(solde.perdu)}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700">{solde && Number(solde.en_attente) > 0 ? formaterJours(solde.en_attente) : "—"}</td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${solde && Number(solde.disponible) < 0 ? "text-red-700" : ""}`}>
                      {solde ? formaterJours(solde.disponible) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Carte>
    </Page>
  );
}
