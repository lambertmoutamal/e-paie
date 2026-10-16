import type { Metadata } from "next";
import { Pencil, Trash2 } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { NOMS_MOIS } from "@/lib/bulletins/regles";
import { DECOMPTES, formaterJours, MODES_VALIDATION, NATURES_ABSENCE, type NatureAbsence } from "@/lib/absences/regles";
import { CaseACocher, Champ, ChoixCartes, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, classesBouton, Page } from "@/components/ui";
import {
  ajouterJourFerie,
  ajouterTypeAbsence,
  basculerTypeAbsence,
  modifierModeValidation,
  modifierParametres,
  modifierRegles,
  modifierTypeAbsence,
  retirerJourFerie,
} from "../actions";
import { chargerContexte, EnTeteAbsences } from "../commun";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Réglages des congés" };

const texte = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export default async function PageReglages({ params }: PageProps<"/espace/entreprises/[id]/absences/reglages">) {
  await connection(); // page calculée à chaque visite (elle lit la date du jour)
  const { id } = await params;
  const { supabase, entreprise, peutGerer } = await chargerContexte(id);
  const debutAnnee = `${new Date().getUTCFullYear()}-01-01`;
  const [{ data: p }, { data: types }, { data: feries }, { data: administrateur }] = await Promise.all([
    supabase
      .from("parametres_conges")
      .select(
        "jours_par_mois, decompte, anciennete_tranche_ans, anciennete_jours_par_tranche, anciennete_plafond, delai_prevenance_jours, solde_negatif_autorise, report_max_jours, mois_debut_reference, validation_absences",
      )
      .eq("entreprise_id", id)
      .maybeSingle(),
    supabase.from("types_absence").select("id, libelle, nature, deduit_solde, jours_max, justificatif_requis, demandable, actif").eq("entreprise_id", id).order("ordre").order("libelle"),
    supabase.from("jours_feries").select("id, jour, libelle").eq("entreprise_id", id).gte("jour", debutAnnee).order("jour"),
    supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: id }),
  ]);
  const mode = (p?.validation_absences ?? "rh") as keyof typeof MODES_VALIDATION;

  return (
    <Page>
      <EnTeteAbsences entrepriseId={id} raisonSociale={entreprise.raison_sociale} onglet="reglages" />

      <Carte titre="Acquisition des congés" description="Le changement s'applique immédiatement au calcul de tous les soldes.">
        {peutGerer ? (
          <Formulaire action={modifierParametres.bind(null, id)} libelleBouton="Enregistrer" colonnes={2}>
            <Champ nom="jours_par_mois" libelle="Jours acquis par mois" requis valeurInitiale={texte(p?.jours_par_mois ?? 2)} aide="Exemple : 2 (soit 24 jours par an)" />
            <ChoixListe
              nom="decompte"
              libelle="Décompte des jours"
              requis
              valeurInitiale={p?.decompte ?? "ouvrables"}
              options={Object.entries(DECOMPTES).map(([valeur, libelle]) => ({ valeur, libelle }))}
            />
            <p className="pt-2 text-sm font-semibold text-doux sm:col-span-2">Jours d&apos;ancienneté (facultatif)</p>
            <Champ nom="anciennete_jours_par_tranche" libelle="Jours en plus par an…" valeurInitiale={texte(p?.anciennete_jours_par_tranche)} aide="Exemple : 1" />
            <Champ nom="anciennete_tranche_ans" libelle="…par tranche de (années de présence)" valeurInitiale={texte(p?.anciennete_tranche_ans)} aide="Exemple : 5 (soit +1 jour à 5 ans, +2 à 10 ans…)" />
            <Champ nom="anciennete_plafond" libelle="Plafond (jours en plus par an)" valeurInitiale={texte(p?.anciennete_plafond)} aide="Laisser vide s'il n'y a pas de plafond." />
          </Formulaire>
        ) : (
          <p className="text-sm">
            {formaterJours(p?.jours_par_mois ?? 2)} par mois · {DECOMPTES[(p?.decompte ?? "ouvrables") as keyof typeof DECOMPTES]}
            {p?.anciennete_tranche_ans ? ` · +${formaterJours(p.anciennete_jours_par_tranche)} par an par tranche de ${p.anciennete_tranche_ans} ans` : ""}
          </p>
        )}
      </Carte>

      <Carte titre="Règles des demandes">
        {peutGerer ? (
          <Formulaire action={modifierRegles.bind(null, id)} libelleBouton="Enregistrer" colonnes={2}>
            <Champ
              nom="delai_prevenance_jours"
              libelle="Délai minimum pour demander un congé (jours)"
              requis
              valeurInitiale={texte(p?.delai_prevenance_jours ?? 0)}
              aide="0 = aucun délai. Ne s'applique pas aux permissions (décès, naissance…)."
            />
            <ChoixListe
              nom="mois_debut_reference"
              libelle="Début de l'année de congés"
              requis
              valeurInitiale={String(p?.mois_debut_reference ?? 1)}
              options={NOMS_MOIS.map((nom, i) => ({ valeur: String(i + 1), libelle: nom }))}
            />
            <Champ
              nom="report_max_jours"
              libelle="Jours reportables sur l'année suivante (maximum)"
              valeurInitiale={texte(p?.report_max_jours)}
              aide="Au-delà, les jours non pris sont perdus au début de l'année de congés. Laisser vide : tout est reporté."
            />
            <CaseACocher nom="solde_negatif_autorise" coche={p?.solde_negatif_autorise ?? true}>
              Autoriser un solde négatif (congé pris par anticipation)
            </CaseACocher>
          </Formulaire>
        ) : (
          <p className="text-sm">
            Délai : {p?.delai_prevenance_jours ?? 0} jour(s) · Solde négatif {p?.solde_negatif_autorise === false ? "interdit" : "autorisé"}
            {p?.report_max_jours !== null && p?.report_max_jours !== undefined ? ` · Report maximum : ${formaterJours(p.report_max_jours)}` : ""}
          </p>
        )}
      </Carte>

      <Carte titre="Qui valide les demandes" description="Seuls les administrateurs peuvent changer ce réglage.">
        {administrateur === true ? (
          <Formulaire action={modifierModeValidation.bind(null, id)} libelleBouton="Enregistrer">
            <ChoixCartes
              nom="validation_absences"
              libelle="Les demandes d'absence sont validées par"
              valeurInitiale={mode}
              options={Object.entries(MODES_VALIDATION).map(([valeur, m]) => ({ valeur, titre: m.libelle, texte: m.aide }))}
            />
          </Formulaire>
        ) : (
          <p className="text-sm">
            <strong>{MODES_VALIDATION[mode].libelle}</strong> — {MODES_VALIDATION[mode].aide}
          </p>
        )}
      </Carte>

      <Carte titre="Types d'absence" description="Les valeurs proposées sont indicatives : adaptez-les à votre convention collective." sansMarge>
        <ul className="divide-y divide-bordure">
          {(types ?? []).map((t) => (
            <li key={t.id} className={`px-4 py-3 text-sm sm:px-5 ${t.actif ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-medium">{t.libelle}</span>
                <Badge>{NATURES_ABSENCE[t.nature as NatureAbsence]}</Badge>
                {t.deduit_solde && <Badge teinte="vert">Déduit du solde</Badge>}
                {t.jours_max && <Badge teinte="bleu">{formaterJours(t.jours_max)} max</Badge>}
                {t.justificatif_requis && <Badge teinte="ambre">Justificatif</Badge>}
                {!t.demandable && <Badge>Saisie RH uniquement</Badge>}
                {!t.actif && <Badge>Désactivé</Badge>}
                {peutGerer && (
                  <form action={basculerTypeAbsence.bind(null, t.id, !t.actif)}>
                    <button type="submit" className={classesBouton("secondaire", "petit")}>
                      {t.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </form>
                )}
              </div>
              {peutGerer && (
                <details className="mt-2">
                  <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-marque hover:underline">
                    <Pencil size={13} aria-hidden />
                    Modifier
                  </summary>
                  <div className="mt-3 max-w-2xl">
                    <Formulaire action={modifierTypeAbsence.bind(null, t.id)} libelleBouton="Enregistrer le type" colonnes={2}>
                      <Champ nom="libelle" libelle="Nom" requis valeurInitiale={t.libelle} />
                      <Champ nom="jours_max" libelle="Nombre de jours maximum" valeurInitiale={texte(t.jours_max)} aide="Laisser vide s'il n'y a pas de limite." />
                      <CaseACocher nom="deduit_solde" coche={t.deduit_solde}>
                        Déduit du solde de congés payés
                      </CaseACocher>
                      <CaseACocher nom="justificatif_requis" coche={t.justificatif_requis}>
                        Justificatif obligatoire
                      </CaseACocher>
                      <CaseACocher nom="demandable" coche={t.demandable}>
                        Le salarié peut le demander depuis son espace
                      </CaseACocher>
                    </Formulaire>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
        {peutGerer && (
          <div className="border-t border-bordure p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold">Ajouter un type</p>
            <Formulaire action={ajouterTypeAbsence.bind(null, id)} libelleBouton="Ajouter" colonnes={2}>
              <Champ nom="libelle" libelle="Nom" requis aide="Exemple : Permission : examen" />
              <ChoixListe nom="nature" libelle="Nature" requis options={Object.entries(NATURES_ABSENCE).map(([valeur, libelle]) => ({ valeur, libelle }))} />
              <Champ nom="jours_max" libelle="Nombre de jours maximum" aide="Laisser vide s'il n'y a pas de limite." />
              <CaseACocher nom="deduit_solde">Déduit du solde de congés payés</CaseACocher>
              <CaseACocher nom="justificatif_requis">Justificatif obligatoire</CaseACocher>
              <CaseACocher nom="demandable" coche>
                Le salarié peut le demander depuis son espace
              </CaseACocher>
            </Formulaire>
          </div>
        )}
      </Carte>

      <Carte titre="Jours fériés" description="Ils ne sont pas décomptés dans les absences. Saisissez ceux de l'année (et les fêtes mobiles)." sansMarge>
        {!feries?.length ? (
          <p className="px-4 py-4 text-sm text-doux sm:px-5">Aucun jour férié saisi pour cette année.</p>
        ) : (
          <ul className="divide-y divide-bordure">
            {feries.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2 text-sm sm:px-5">
                <span className="w-36 shrink-0 font-medium">{formaterDate(f.jour)}</span>
                <span className="flex-1">{f.libelle}</span>
                {peutGerer && (
                  <form action={retirerJourFerie.bind(null, f.id)}>
                    <button type="submit" className={classesBouton("danger", "petit")} aria-label={`Retirer ${f.libelle}`} title="Retirer">
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {peutGerer && (
          <div className="border-t border-bordure p-4 sm:p-5">
            <Formulaire action={ajouterJourFerie.bind(null, id)} libelleBouton="Ajouter le jour férié" colonnes={2}>
              <Champ nom="jour" libelle="Date" type="date" requis />
              <Champ nom="libelle" libelle="Nom" requis aide="Exemple : Fête de l'Indépendance" />
            </Formulaire>
          </div>
        )}
      </Carte>
    </Page>
  );
}
