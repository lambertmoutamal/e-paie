import type { Metadata } from "next";
import { CalendarCheck2, Inbox, Paperclip } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { formaterJours, libelleDates, NATURES_ABSENCE, STATUTS_DEMANDE, type NatureAbsence, type StatutDemande } from "@/lib/absences/regles";
import { champLie } from "@/lib/supabase/relations";
import { Champ, ChampFichier, ChoixListe, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Badge, Carte, EtatVide, Page } from "@/components/ui";
import { annulerAbsence, deciderDemande, saisirAbsence } from "./actions";
import { chargerContexte, EnTeteAbsences, lienJustificatif } from "./commun";
import { AnnulationAbsence, DecisionDemande } from "./formulaires";

export const metadata: Metadata = { title: "Congés et absences" };

const CHAMPS =
  "id, salarie_id, debut, fin, debut_apres_midi, fin_midi, nb_jours, statut, motif, justificatif_chemin, saisie_rh, commentaire_decision, cree_le, decide_le, salaries(nom, prenoms, matricule), types_absence(libelle, nature, deduit_solde)";

export default async function PageDemandes({ params }: PageProps<"/espace/entreprises/[id]/absences">) {
  const { id } = await params;
  const { supabase, entreprise, peutGerer } = await chargerContexte(id);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [{ data: enAttente }, { data: historique }, { data: soldes }, { data: salaries }, { data: types }] = await Promise.all([
    supabase.from("demandes_absence").select(CHAMPS).eq("entreprise_id", id).eq("statut", "en_attente").order("cree_le"),
    supabase.from("demandes_absence").select(CHAMPS).eq("entreprise_id", id).in("statut", ["acceptee", "refusee", "annulee"]).order("debut", { ascending: false }).limit(60),
    supabase.rpc("soldes_entreprise", { p_entreprise_id: id }),
    supabase.from("salaries").select("id, nom, prenoms, matricule").eq("entreprise_id", id).eq("statut", "actif").order("nom"),
    supabase.from("types_absence").select("id, libelle").eq("entreprise_id", id).eq("actif", true).order("ordre"),
  ]);
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
                    {d.motif && <p className="mt-1 rounded-lg bg-black/[.03] px-3 py-2">{d.motif}</p>}
                    {d.justificatif_chemin && (
                      <a href={lienJustificatif(d.justificatif_chemin)} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-marque hover:underline">
                        <Paperclip size={14} aria-hidden />
                        Voir le justificatif
                      </a>
                    )}
                    <p className="mt-1 text-xs text-doux">Demandée le {formaterDate(d.cree_le)}</p>
                  </div>
                  {peutGerer && <DecisionDemande action={deciderDemande.bind(null, d.id)} />}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {peutGerer && (
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
      )}

      <Carte titre="Historique" description="Les 60 dernières absences traitées." sansMarge>
        {!historique?.length ? (
          <EtatVide icone={CalendarCheck2} titre="Aucune absence pour l'instant" />
        ) : (
          <ul className="divide-y divide-bordure">
            {historique.map((d) => {
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
        )}
      </Carte>
    </Page>
  );
}
