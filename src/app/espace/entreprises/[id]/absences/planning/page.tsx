import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bornesMois, libellePeriode, salariesAttendus } from "@/lib/bulletins/regles";
import { NATURES_ABSENCE, type NatureAbsence } from "@/lib/absences/regles";
import { Carte, classesBouton, Page } from "@/components/ui";
import { chargerContexte, EnTeteAbsences } from "../commun";

export const metadata: Metadata = { title: "Planning des absences" };

const COULEURS: Record<NatureAbsence, string> = {
  conge: "bg-marque",
  permission: "bg-sky-500",
  maladie: "bg-red-500",
  autre: "bg-gray-500",
};
const INITIALES = ["L", "M", "M", "J", "V", "S", "D"];

function moisDecale(annee: number, mois: number, decalage: number) {
  const d = new Date(Date.UTC(annee, mois - 1 + decalage, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PagePlanning({ params, searchParams }: PageProps<"/espace/entreprises/[id]/absences/planning">) {
  const { id } = await params;
  const { mois: parametre } = await searchParams;
  const maintenant = new Date();
  const valide = typeof parametre === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(parametre);
  const annee = valide ? Number(parametre.slice(0, 4)) : maintenant.getUTCFullYear();
  const mois = valide ? Number(parametre.slice(5, 7)) : maintenant.getUTCMonth() + 1;
  const { debut, fin } = bornesMois(annee, mois);
  const nbJours = Number(fin.slice(8, 10));

  const { supabase, entreprise } = await chargerContexte(id);
  const [{ data: salaries }, { data: demandes }, { data: feries }, { data: parametres }] = await Promise.all([
    supabase.from("salaries").select("id, matricule, nom, prenoms, statut, date_embauche, date_sortie").eq("entreprise_id", id).order("nom"),
    supabase
      .from("demandes_absence")
      .select("salarie_id, debut, fin, debut_apres_midi, fin_midi, statut, types_absence(libelle, nature)")
      .eq("entreprise_id", id)
      .in("statut", ["acceptee", "en_attente"])
      .lte("debut", fin)
      .gte("fin", debut),
    supabase.from("jours_feries").select("jour, libelle").eq("entreprise_id", id).gte("jour", debut).lte("jour", fin),
    supabase.from("parametres_conges").select("decompte").eq("entreprise_id", id).maybeSingle(),
  ]);

  const presents = salariesAttendus(salaries ?? [], annee, mois);
  const ferie = new Map((feries ?? []).map((f) => [f.jour, f.libelle]));
  const jours = Array.from({ length: nbJours }, (_, i) => {
    const date = `${debut.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
    const jourSemaine = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
    const repos = jourSemaine === 6 || (parametres?.decompte === "ouvres" && jourSemaine === 5) || ferie.has(date);
    return { date, numero: i + 1, initiale: INITIALES[jourSemaine], repos, ferie: ferie.get(date) };
  });
  const absencesDe = new Map<string, NonNullable<typeof demandes>>();
  for (const d of demandes ?? []) absencesDe.set(d.salarie_id, [...(absencesDe.get(d.salarie_id) ?? []), d]);
  const absentsCeMois = presents.filter((s) => absencesDe.has(s.id)).length;

  return (
    <Page>
      <EnTeteAbsences entrepriseId={id} raisonSociale={entreprise.raison_sociale} onglet="planning" />

      <div className="flex items-center justify-between gap-2">
        <Link href={`?mois=${moisDecale(annee, mois, -1)}`} className={classesBouton("secondaire", "petit")} aria-label="Mois précédent">
          <ChevronLeft size={16} aria-hidden />
        </Link>
        <h2 className="text-lg font-semibold">{libellePeriode(annee, mois)}</h2>
        <Link href={`?mois=${moisDecale(annee, mois, 1)}`} className={classesBouton("secondaire", "petit")} aria-label="Mois suivant">
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      <Carte titre={`${absentsCeMois} salarié(s) absent(s) ce mois-ci`} description="Les absences en attente de réponse sont hachurées." sansMarge>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-40 bg-surface px-3 py-2 text-left font-semibold">
                  Salarié
                </th>
                {jours.map((j) => (
                  <th key={j.date} scope="col" title={j.ferie} className={`w-7 min-w-7 px-0 py-1 text-center font-medium ${j.repos ? "bg-black/[.04] text-doux" : ""}`}>
                    <span className="block">{j.initiale}</span>
                    <span className="block">{j.numero}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {presents.map((s) => {
                const absences = absencesDe.get(s.id) ?? [];
                return (
                  <tr key={s.id} className="border-t border-bordure">
                    <th scope="row" className="sticky left-0 z-10 truncate bg-surface px-3 py-1.5 text-left font-medium">
                      {s.nom} {s.prenoms}
                    </th>
                    {jours.map((j) => {
                      const a = absences.find((x) => x.debut <= j.date && x.fin >= j.date);
                      const type = a?.types_absence as unknown as { libelle: string; nature: NatureAbsence } | undefined;
                      const demi = a && ((a.debut === j.date && a.debut_apres_midi) || (a.fin === j.date && a.fin_midi));
                      return (
                        <td key={j.date} className={`h-8 p-0.5 ${j.repos ? "bg-black/[.04]" : ""}`} title={type ? `${type.libelle}${a?.statut === "en_attente" ? " (en attente)" : ""}` : j.ferie}>
                          {type && !j.repos && (
                            <span
                              className={`block h-full rounded-sm ${COULEURS[type.nature]} ${demi ? "w-1/2" : "w-full"} ${
                                a?.statut === "en_attente" ? "bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.6)_3px_6px)] opacity-70" : ""
                              }`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-bordure px-4 py-3 text-xs text-doux sm:px-5">
          {(Object.keys(COULEURS) as NatureAbsence[]).map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className={`size-3 rounded-sm ${COULEURS[n]}`} aria-hidden />
              {NATURES_ABSENCE[n]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-black/[.08]" aria-hidden />
            Repos ou jour férié
          </span>
        </div>
      </Carte>
    </Page>
  );
}
