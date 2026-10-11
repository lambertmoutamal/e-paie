import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, CircleCheck, Palmtree } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { formaterJours, libelleDates, STATUTS_DEMANDE, type StatutDemande } from "@/lib/absences/regles";
import { Badge, Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { annulerMaDemande } from "./actions";

export const metadata: Metadata = { title: "Mes absences" };

type Emploi = { salarie_id: string; raison_sociale: string; statut: string };
type Solde = { acquis: number; anciennete: number; pris: number; perdu: number; en_attente: number; disponible: number };
type Demande = {
  id: string;
  raison_sociale: string;
  type_libelle: string;
  debut: string;
  fin: string;
  debut_apres_midi: boolean;
  fin_midi: boolean;
  nb_jours: number;
  statut: StatutDemande;
  commentaire_decision: string | null;
  saisie_rh: boolean;
};

export default async function PageMesAbsences({ searchParams }: PageProps<"/portail/absences">) {
  const { envoyee } = await searchParams;
  const supabase = await clientSupabaseServeur();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) redirect("/portail/connexion");

  const [{ data: emplois }, { data: demandes }] = await Promise.all([supabase.rpc("mes_emplois"), supabase.rpc("mes_demandes_absence")]);
  const actifs = ((emplois ?? []) as Emploi[]).filter((e) => e.statut === "actif");
  const soldes = await Promise.all(
    actifs.map(async (e) => {
      const [{ data }, { data: dernier }] = await Promise.all([
        supabase.rpc("mon_solde_conges", { p_salarie_id: e.salarie_id }),
        supabase.rpc("mon_dernier_conge", { p_salarie_id: e.salarie_id }),
      ]);
      return { emploi: e, solde: (data?.[0] ?? null) as Solde | null, dernier: (dernier?.[0] ?? null) as { debut: string; fin: string } | null };
    }),
  );
  const liste = (demandes ?? []) as Demande[];

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes absences</h1>
          <p className="mt-1 text-doux">Congés et permissions : demandez, suivez, retrouvez l&apos;historique.</p>
        </div>
        {actifs.length > 0 && (
          <Link href="/portail/absences/nouvelle" className={`${classesBouton()} h-12`}>
            <CalendarPlus size={18} aria-hidden />
            Nouvelle demande
          </Link>
        )}
      </header>

      {envoyee && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-marque/20 bg-marque-claire px-3 py-2 text-sm text-marque-fonce">
          <CircleCheck size={16} aria-hidden />
          Demande envoyée. Vous serez prévenu de la réponse.
        </p>
      )}

      {soldes.map(({ emploi, solde, dernier }) =>
        solde ? (
          <section key={emploi.salarie_id} className="rounded-xl border border-bordure bg-surface p-4">
            {soldes.length > 1 && <p className="mb-2 text-sm font-semibold">{emploi.raison_sociale}</p>}
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-marque-claire text-marque">
                <Palmtree size={22} aria-hidden />
              </span>
              <div>
                <p className="text-3xl font-bold tabular-nums">{formaterJours(solde.disponible)}</p>
                <p className="text-sm text-doux">de congés payés disponibles</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-doux">
              Acquis : {formaterJours(Number(solde.acquis) + Number(solde.anciennete))} · Pris : {formaterJours(solde.pris)}
              {Number(solde.perdu) > 0 ? ` · Non reportés : ${formaterJours(solde.perdu)}` : ""}
              {Number(solde.en_attente) > 0 ? ` · En attente de réponse : ${formaterJours(solde.en_attente)}` : ""}
            </p>
            {dernier && <p className="mt-1 text-xs text-doux">Dernier congé : {libelleDates(dernier)}</p>}
          </section>
        ) : null,
      )}

      <Carte titre="Mes demandes" sansMarge>
        {liste.length === 0 ? (
          <EtatVide icone={CalendarPlus} titre="Aucune demande pour l'instant" />
        ) : (
          <ul className="divide-y divide-bordure">
            {liste.map((d) => {
              const statut = STATUTS_DEMANDE[d.statut];
              return (
                <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.type_libelle}</p>
                    <p className="text-doux">
                      {libelleDates(d)} · {formaterJours(d.nb_jours)}
                      {soldes.length > 1 ? ` · ${d.raison_sociale}` : ""}
                      {d.saisie_rh ? " · saisie par le RH" : ""}
                    </p>
                    {d.commentaire_decision && <p className="mt-1 rounded-lg bg-black/[.03] px-3 py-2">« {d.commentaire_decision} »</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
                    {d.statut === "en_attente" && (
                      <form action={annulerMaDemande.bind(null, d.id)}>
                        <button type="submit" className={classesBouton("secondaire", "petit")}>
                          Annuler
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </Page>
  );
}
