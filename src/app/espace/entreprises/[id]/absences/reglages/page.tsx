import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { DECOMPTES, formaterJours, NATURES_ABSENCE, type NatureAbsence } from "@/lib/absences/regles";
import { CaseACocher, Champ, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, classesBouton, Page } from "@/components/ui";
import { ajouterJourFerie, ajouterTypeAbsence, basculerTypeAbsence, modifierParametres, retirerJourFerie } from "../actions";
import { chargerContexte, EnTeteAbsences } from "../commun";

export const metadata: Metadata = { title: "Réglages des congés" };

export default async function PageReglages({ params }: PageProps<"/espace/entreprises/[id]/absences/reglages">) {
  const { id } = await params;
  const { supabase, entreprise, peutGerer } = await chargerContexte(id);
  const debutAnnee = `${new Date().getUTCFullYear()}-01-01`;
  const [{ data: parametres }, { data: types }, { data: feries }] = await Promise.all([
    supabase.from("parametres_conges").select("jours_par_mois, decompte").eq("entreprise_id", id).maybeSingle(),
    supabase.from("types_absence").select("id, libelle, nature, deduit_solde, jours_max, justificatif_requis, demandable, actif").eq("entreprise_id", id).order("ordre").order("libelle"),
    supabase.from("jours_feries").select("id, jour, libelle").eq("entreprise_id", id).gte("jour", debutAnnee).order("jour"),
  ]);

  return (
    <Page>
      <EnTeteAbsences entrepriseId={id} raisonSociale={entreprise.raison_sociale} onglet="reglages" />

      <Carte titre="Acquisition des congés" description="Le changement s'applique immédiatement au calcul de tous les soldes.">
        {peutGerer ? (
          <Formulaire action={modifierParametres.bind(null, id)} libelleBouton="Enregistrer" colonnes={2}>
            <Champ nom="jours_par_mois" libelle="Jours acquis par mois" requis valeurInitiale={String(parametres?.jours_par_mois ?? 2)} aide="Exemple : 2 (soit 24 jours par an)" />
            <ChoixListe
              nom="decompte"
              libelle="Décompte des jours"
              requis
              valeurInitiale={parametres?.decompte ?? "ouvrables"}
              options={Object.entries(DECOMPTES).map(([valeur, libelle]) => ({ valeur, libelle }))}
            />
          </Formulaire>
        ) : (
          <p className="text-sm">
            {formaterJours(parametres?.jours_par_mois ?? 2)} par mois · {DECOMPTES[(parametres?.decompte ?? "ouvrables") as keyof typeof DECOMPTES]}
          </p>
        )}
      </Carte>

      <Carte titre="Types d'absence" description="Les valeurs proposées sont indicatives : adaptez-les à votre convention collective." sansMarge>
        <ul className="divide-y divide-bordure">
          {(types ?? []).map((t) => (
            <li key={t.id} className={`flex flex-wrap items-center gap-2 px-4 py-3 text-sm sm:px-5 ${t.actif ? "" : "opacity-50"}`}>
              <span className="min-w-0 flex-1 font-medium">{t.libelle}</span>
              <Badge>{NATURES_ABSENCE[t.nature as NatureAbsence]}</Badge>
              {t.deduit_solde && <Badge teinte="vert">Déduit du solde</Badge>}
              {t.jours_max && <Badge teinte="bleu">{formaterJours(t.jours_max)} max</Badge>}
              {t.justificatif_requis && <Badge teinte="ambre">Justificatif</Badge>}
              {!t.demandable && <Badge>Saisie RH uniquement</Badge>}
              {peutGerer && (
                <form action={basculerTypeAbsence.bind(null, t.id, !t.actif)}>
                  <button type="submit" className={classesBouton("secondaire", "petit")}>
                    {t.actif ? "Désactiver" : "Réactiver"}
                  </button>
                </form>
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
