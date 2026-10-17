import type { Metadata } from "next";
import { CalendarCheck2, Inbox, Paperclip } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { formaterJours, libelleDates, NATURES_ABSENCE, STATUTS_DEMANDE, type NatureAbsence, type StatutDemande } from "@/lib/absences/regles";
import { champLie } from "@/lib/supabase/relations";
import { Champ, ChampFichier, ChoixListe, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Badge, Carte, EtatVide, LienBouton, Page } from "@/components/ui";
import { Pastilles } from "@/components/tableau";
import { annulerAbsence, deciderDemande, saisirAbsence } from "./actions";
import { chargerContexte, EnTeteAbsences, lienJustificatif } from "./commun";
import { AnnulationAbsence, DecisionDemande } from "./formulaires";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Congés et absences" };

const CHAMPS =
  "id, salarie_id, prevalidee_le, debut, fin, debut_apres_midi, fin_midi, nb_jours, statut, motif, justificatif_chemin, saisie_rh, commentaire_decision, cree_le, decide_le, salaries(nom, prenoms, matricule), types_absence(libelle, nature, deduit_solde)";

export default async function PageDemandes({ params, searchParams }: PageProps<"/espace/entreprises/[id]/absences">) {
  await connection(); // page calculée à chaque visite (elle lit la date du jour)
  const { id } = await params;
  const { statut } = await searchParams;
  const filtre = typeof statut === "string" && statut in STATUTS_DEMANDE && statut !== "en_attente" ? (statut as StatutDemande) : "tous";
  const { supabase, entreprise, peutGerer } = await chargerContexte(id);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [{ data: enAttente }, { data: historique }, { data: soldes }, { data: salaries }, { data: types }, { data: derniers }] = await Promise.all([
    supabase.from("demandes_absence").select(CHAMPS).eq("entreprise_id", id).eq("statut", "en_attente").order("cree_le"),
    supabase.from("demandes_absence").select(CHAMPS).eq("entreprise_id", id).in("statut", ["acceptee", "refusee", "annulee"]).order("debut", { ascending: false }).limit(60),
    supabase.rpc("soldes_entreprise", { p_entreprise_id: id }),
    supabase.from("salaries").select("id, nom, prenoms, matricule").eq("entreprise_id", id).eq("statut", "actif").order("nom"),
    supabase.from("types_absence").select("id, libelle").eq("entreprise_id", id).eq("actif", true).order("ordre"),
    supabase.rpc("derniers_conges_entreprise", { p_entreprise_id: id }),
  ]);
  const toutes = historique ?? [];
  const visibles = filtre === "tous" ? toutes : toutes.filter((d) => d.statut === filtre);
  const lienFiltre = (s: string) => `/espace/entreprises/${id}/absences${s === "tous" ? "" : `?statut=${s}`}#historique`;
  const dernierDe = new Map(((derniers ?? []) as { salarie_id: string; debut: string; fin: string }[]).map((d) => [d.salarie_id, d]));
  const soldeDe = new Map(((soldes ?? []) as { salarie_id: string; disponible: number }[]).map((s) => [s.salarie_id, Number(s.disponible)]));

  return (
    <Page>
      <EnTeteAbsences entrepriseId={id} raisonSociale={entreprise.raison_sociale} onglet="demandes" />

      <Carte titre="Demandes en attente" description="Les plus anciennes en premier." sansMarge>
        {!enAttente?.length ? (
          <EtatVide icone={Inbox} titre="Aucune demande en attente" texte="Les salariés font leurs demandes depuis leur espace, sur leur téléphone." />
        ) : (
          <ul className="divide-y divide-bordure">
            {enAttente.map((d) => {
              const type = d.types_absence as unknown as { libelle: string; deduit_solde: boolean };
              const solde = soldeDe.get(d.salarie_id);
              const depasse = type.deduit_solde && solde !== undefined && Number(d.nb_jours) > solde;
              return (
                <li key={d.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1fr_22rem]">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {champLie(d.salaries, "nom")} {champLie(d.salaries, "prenoms")}{" "}
                      <span className="font-normal text-doux">· {champLie(d.salaries, "matricule")}</span>
                    </p>
                    <p className="mt-0.5">
                      <span className="font-medium">{type.libelle}</span> · {libelleDates(d)} · <strong>{formaterJours(d.nb_jours)}</strong>
                    </p>
                    {type.deduit_solde && solde !== undefined && (
                      <p className={depasse ? "text-red-700" : "text-doux"}>
                        Solde disponible : {formaterJours(solde)}
                        {depasse ? " — la demande dépasse le solde" : ""}
                      </p>
                    )}
                    <p className="text-doux">
                      Dernier congé : {dernierDe.get(d.salarie_id) ? libelleDates(dernierDe.get(d.salarie_id)!) : "aucun enregistré"}
                    </p>
                    {d.motif && <p className="mt-1 rounded-lg bg-black/[.03] px-3 py-2">{d.motif}</p>}
                    {d.justificatif_chemin && (
                      <a href={lienJustificatif(d.justificatif_chemin)} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-marque hover:underline">
                        <Paperclip size={14} aria-hidden />
                        Voir le justificatif
                      </a>
                    )}
                    <p className="mt-1 text-xs text-doux">Demandée le {formaterDate(d.cree_le)}</p>
                    {d.prevalidee_le && (
                      <p className="mt-1">
                        <Badge teinte="bleu">Premier accord du RH le {formaterDate(d.prevalidee_le)}</Badge>
                      </p>
                    )}
                  </div>
                  {peutGerer && <DecisionDemande action={deciderDemande.bind(null, d.id)} />}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {peutGerer && (
        <div id="saisir-absence" className="scroll-mt-24">
        <Carte titre="Saisir une absence" description="Maladie, absence injustifiée, congé pris sans demande… L'absence est enregistrée comme acceptée et le salarié est prévenu.">
          <Formulaire action={saisirAbsence.bind(null, id)} libelleBouton="Enregistrer l'absence" colonnes={2}>
            <ChoixListe
              nom="salarie_id"
              libelle="Salarié"
              requis
              options={(salaries ?? []).map((s) => ({ valeur: s.id, libelle: `${s.nom} ${s.prenoms} (${s.matricule})` }))}
            />
            <ChoixListe nom="type_id" libelle="Type d'absence" requis options={(types ?? []).map((t) => ({ valeur: t.id, libelle: t.libelle }))} />
            <Champ nom="debut" libelle="Du" type="date" requis valeurInitiale={aujourdhui} />
            <Champ nom="fin" libelle="Au" type="date" requis valeurInitiale={aujourdhui} />
            <ZoneTexte nom="motif" libelle="Commentaire (facultatif)" max={500} />
            <ChampFichier libelle="Justificatif (facultatif)" />
          </Formulaire>
        </Carte>
        </div>
      )}

      <div id="historique" className="scroll-mt-24">
      <Carte titre="Historique" description="Les 60 dernières absences traitées." sansMarge>
        {!toutes.length ? (
          <EtatVide
            icone={CalendarCheck2}
            titre="Aucune absence pour l'instant"
            action={
              peutGerer ? (
                <LienBouton href="#saisir-absence" variante="secondaire">
                  Saisir une absence
                </LienBouton>
              ) : undefined
            }
          />
        ) : (
          <>
          <div className="border-b border-bordure p-4 sm:px-5">
            <Pastilles
              libelle="Filtrer par décision"
              elements={[
                { href: lienFiltre("tous"), libelle: "Toutes", actif: filtre === "tous", nombre: toutes.length },
                ...(["acceptee", "refusee", "annulee"] as StatutDemande[]).map((s) => ({
                  href: lienFiltre(s),
                  libelle: STATUTS_DEMANDE[s].libelle,
                  actif: filtre === s,
                  nombre: toutes.filter((d) => d.statut === s).length,
                })),
              ]}
            />
          </div>
          {!visibles.length && (
            <EtatVide
              icone={CalendarCheck2}
              titre="Aucune absence avec ce statut"
              action={
                <LienBouton href={lienFiltre("tous")} variante="secondaire">
                  Voir toutes les absences
                </LienBouton>
              }
            />
          )}
          <ul className="divide-y divide-bordure">
            {visibles.map((d) => {
              const type = d.types_absence as unknown as { libelle: string; nature: NatureAbsence };
              const statut = STATUTS_DEMANDE[d.statut as StatutDemande];
              return (
                <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {champLie(d.salaries, "nom")} {champLie(d.salaries, "prenoms")} · {type.libelle}
                    </p>
                    <p className="text-doux">
                      {libelleDates(d)} · {formaterJours(d.nb_jours)}
                      {d.saisie_rh ? " · saisie par le RH" : ""}
                      {d.commentaire_decision ? ` · « ${d.commentaire_decision} »` : ""}
                    </p>
                    {d.justificatif_chemin && (
                      <a href={lienJustificatif(d.justificatif_chemin)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-marque hover:underline">
                        <Paperclip size={14} aria-hidden />
                        Justificatif
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className="flex gap-1">
                      <Badge>{NATURES_ABSENCE[type.nature]}</Badge>
                      <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
                    </span>
                    {peutGerer && d.statut === "acceptee" && d.fin >= aujourdhui && <AnnulationAbsence action={annulerAbsence.bind(null, d.id)} />}
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </Carte>
      </div>
    </Page>
  );
}
