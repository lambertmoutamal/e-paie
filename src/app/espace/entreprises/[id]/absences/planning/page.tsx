import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { bornesMois, libellePeriode, salariesAttendus } from "@/lib/bulletins/regles";
import { formaterJours, libelleDates, NATURES_ABSENCE, type NatureAbsence } from "@/lib/absences/regles";
import { champLie } from "@/lib/supabase/relations";
import { ActionEnLigne, Champ, ChoixListe, Formulaire } from "@/components/formulaire";
import { Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { confirmerPrevision, prevoirConge, supprimerPrevision } from "../actions";
import { chargerContexte, EnTeteAbsences } from "../commun";
import { connection } from "next/server";

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
  await connection(); // page calculée à chaque visite (elle lit la date du jour)
  const { id } = await params;
  const { mois: parametre } = await searchParams;
  const maintenant = new Date();
  const valide = typeof parametre === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(parametre);
  const annee = valide ? Number(parametre.slice(0, 4)) : maintenant.getUTCFullYear();
  const mois = valide ? Number(parametre.slice(5, 7)) : maintenant.getUTCMonth() + 1;
  const { debut, fin } = bornesMois(annee, mois);
  const nbJours = Number(fin.slice(8, 10));

  const { supabase, entreprise, peutGerer, peutPrevoir } = await chargerContexte(id);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [{ data: salaries }, { data: demandes }, { data: feries }, { data: parametres }, { data: previsions }, { data: types }] = await Promise.all([
    supabase.from("salaries").select("id, matricule, nom, prenoms, statut, date_embauche, date_sortie").eq("entreprise_id", id).order("nom"),
    supabase
      .from("demandes_absence")
      .select("salarie_id, debut, fin, debut_apres_midi, fin_midi, statut, types_absence(libelle, nature)")
      .eq("entreprise_id", id)
      .in("statut", ["acceptee", "en_attente", "prevue"])
      .lte("debut", fin)
      .gte("fin", debut),
    supabase.from("jours_feries").select("jour, libelle").eq("entreprise_id", id).gte("jour", debut).lte("jour", fin),
    supabase.from("parametres_conges").select("decompte").eq("entreprise_id", id).maybeSingle(),
    supabase
      .from("demandes_absence")
      .select("id, debut, fin, nb_jours, motif, salaries(nom, prenoms, matricule), types_absence(libelle)")
      .eq("entreprise_id", id)
      .eq("statut", "prevue")
      .gte("fin", aujourdhui)
      .order("debut"),
    supabase.from("types_absence").select("id, libelle, nature").eq("entreprise_id", id).eq("actif", true).order("ordre"),
  ]);
  const congePaye = (types ?? []).find((t) => t.nature === "conge");

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
                      // Une absence réelle passe avant une prévision sur le même jour
                      const duJour = absences.filter((x) => x.debut <= j.date && x.fin >= j.date);
                      const a = duJour.find((x) => x.statut !== "prevue") ?? duJour[0];
                      const prevue = a?.statut === "prevue";
                      const type = a?.types_absence as unknown as { libelle: string; nature: NatureAbsence } | undefined;
                      const demi = a && ((a.debut === j.date && a.debut_apres_midi) || (a.fin === j.date && a.fin_midi));
                      return (
                        <td key={j.date} className={`h-8 p-0.5 ${j.repos ? "bg-black/[.04]" : ""}`} title={type ? `${type.libelle}${a?.statut === "en_attente" ? " (en attente)" : prevue ? " (prévisionnel)" : ""}` : j.ferie}>
                          {type && !j.repos && prevue && <span className="block h-full w-full rounded-sm border-2 border-dashed border-marque/70 bg-marque/10" />}
                          {type && !j.repos && !prevue && (
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
            <span className="size-3 rounded-sm border-2 border-dashed border-marque/70 bg-marque/10" aria-hidden />
            Congé prévisionnel
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-black/[.08]" aria-hidden />
            Repos ou jour férié
          </span>
        </div>
      </Carte>

      <Carte
        titre="Congés prévisionnels"
        description="Dates prévues, pas encore validées : elles ne sont pas déduites du solde. Le RH les confirme le moment venu."
        sansMarge
      >
        {!previsions?.length ? (
          <EtatVide icone={CalendarClock} titre="Aucun congé prévu" />
        ) : (
          <ul className="divide-y divide-bordure">
            {previsions.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {champLie(p.salaries, "nom")} {champLie(p.salaries, "prenoms")}{" "}
                    <span className="font-normal text-doux">· {champLie(p.salaries, "matricule")}</span>
                  </p>
                  <p className="text-doux">
                    {champLie(p.types_absence, "libelle")} · {libelleDates(p)} · {formaterJours(p.nb_jours)}
                    {p.motif ? ` · ${p.motif}` : ""}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  {peutGerer && <ActionEnLigne action={confirmerPrevision.bind(null, p.id)} libelle="Confirmer" />}
                  {peutPrevoir && (
                    <form action={supprimerPrevision.bind(null, p.id)}>
                      <button type="submit" className={classesBouton("danger", "petit")} aria-label="Supprimer la prévision" title="Supprimer">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {peutPrevoir && (
          <div className="border-t border-bordure p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold">Ajouter un congé prévisionnel</p>
            <Formulaire action={prevoirConge} libelleBouton="Enregistrer la prévision" colonnes={2}>
              <ChoixListe
                nom="salarie_id"
                libelle="Salarié"
                requis
                options={(salaries ?? [])
                  .filter((s) => s.statut === "actif")
                  .map((s) => ({ valeur: s.id, libelle: `${s.nom} ${s.prenoms} (${s.matricule})` }))}
              />
              <ChoixListe
                nom="type_id"
                libelle="Type"
                requis
                valeurInitiale={congePaye?.id}
                options={(types ?? []).map((t) => ({ valeur: t.id, libelle: t.libelle }))}
              />
              <Champ nom="debut" libelle="Du" type="date" requis />
              <Champ nom="fin" libelle="Au" type="date" requis />
              <Champ nom="motif" libelle="Commentaire (facultatif)" />
            </Formulaire>
          </div>
        )}
      </Carte>
    </Page>
  );
}
