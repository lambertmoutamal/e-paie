import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleAlert, FileCheck2, FileText, Lock, Trash2, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { libellePeriode, salariesAttendus, STATUTS_PERIODE, type StatutPeriode } from "@/lib/bulletins/regles";
import { ActionEnLigne } from "@/components/formulaire";
import { Badge, Carte, classesBouton, EnTetePage, EtatVide, Page, Statistique } from "@/components/ui";
import { retirerBulletin, supprimerPeriode } from "../actions";
import { DepotEnMasse, DepotUnique } from "./depot-bulletins";

export const metadata: Metadata = { title: "Période de paie" };

const TAILLE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const taille = (octets: number) => (octets > 1024 * 1024 ? `${TAILLE.format(octets / 1024 / 1024)} Mo` : `${Math.ceil(octets / 1024)} Ko`);
const lienBulletin = (chemin: string) => `/espace/fichiers?espace=bulletins&chemin=${encodeURIComponent(chemin)}`;

export default async function PagePeriode({ params }: PageProps<"/espace/entreprises/[id]/paie/[periodeId]">) {
  const { id, periodeId } = await params;
  const { supabase } = await exigerUtilisateur();

  const [{ data: entreprise }, { data: periode }, { data: salaries }, { data: bulletins }, { data: peutDeposer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.from("periodes_paie").select("id, annee, mois, statut").eq("id", periodeId).eq("entreprise_id", id).maybeSingle(),
    supabase
      .from("salaries")
      .select("id, matricule, nom, prenoms, statut, date_embauche, date_sortie")
      .eq("entreprise_id", id)
      .order("nom")
      .order("prenoms"),
    supabase
      .from("bulletins")
      .select("id, salarie_id, fichier_chemin, fichier_nom, taille, empreinte_sha256, depose_le")
      .eq("periode_id", periodeId)
      .eq("type", "normal"),
    supabase.rpc("peut_deposer_bulletins", { p_entreprise_id: id }),
  ]);
  if (!entreprise || !periode) notFound();

  const titre = libellePeriode(periode.annee, periode.mois);
  const statut = STATUTS_PERIODE[periode.statut as StatutPeriode];
  const modifiable = peutDeposer === true && periode.statut === "brouillon";

  const parSalarie = new Map((bulletins ?? []).map((b) => [b.salarie_id, b]));
  const attendus = salariesAttendus(salaries ?? [], periode.annee, periode.mois);
  const idsAttendus = new Set(attendus.map((s) => s.id));
  // Un bulletin déposé pour un salarié hors période (ex. sorti plus tôt) reste affiché.
  const horsListe = (salaries ?? []).filter((s) => !idsAttendus.has(s.id) && parSalarie.has(s.id));
  const lignes = [...attendus, ...horsListe].sort((a, b) => Number(parSalarie.has(a.id)) - Number(parSalarie.has(b.id)));
  const manquants = attendus.filter((s) => !parSalarie.has(s.id)).length;

  return (
    <Page>
      <EnTetePage
        titre={`Paie de ${titre}`}
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/paie`, libelle: "Paie et bulletins" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
            {modifiable && !bulletins?.length && (
              <ActionEnLigne action={supprimerPeriode.bind(null, id, periodeId)} libelle="Supprimer la période" variante="danger" />
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Statistique icone={Users} libelle="Salariés attendus" valeur={attendus.length} />
        <Statistique icone={FileCheck2} libelle="Bulletins déposés" valeur={bulletins?.length ?? 0} />
        <Statistique icone={CircleAlert} libelle="Bulletins manquants" valeur={manquants} />
      </div>

      {periode.statut !== "brouillon" && (
        <p className="flex items-start gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-doux">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          Cette période est verrouillée : les bulletins ne peuvent plus être déposés, remplacés ni retirés.
        </p>
      )}

      {modifiable && (
        <Carte titre="Déposer les bulletins en masse" description="Tous les bulletins du mois en une seule fois.">
          <DepotEnMasse
            entrepriseId={id}
            periodeId={periodeId}
            annee={periode.annee}
            mois={periode.mois}
            salaries={attendus.map((s) => ({ id: s.id, matricule: s.matricule, nom: s.nom, prenoms: s.prenoms, aBulletin: parSalarie.has(s.id) }))}
          />
        </Carte>
      )}

      <Carte titre="Bulletins par salarié" description="Les salariés sans bulletin apparaissent en premier." sansMarge>
        {lignes.length === 0 ? (
          <EtatVide icone={Users} titre="Aucun salarié attendu" texte={`Aucun salarié n'est en poste en ${titre}.`} />
        ) : (
          <ul className="divide-y divide-bordure">
            {lignes.map((s) => {
              const b = parSalarie.get(s.id);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <FileText size={20} className={`shrink-0 ${b ? "text-marque" : "text-doux"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.nom} {s.prenoms} <span className="font-normal text-doux">· {s.matricule}</span>
                    </p>
                    {b ? (
                      <p className="truncate text-sm text-doux">
                        <a href={lienBulletin(b.fichier_chemin)} target="_blank" rel="noopener" className="text-marque hover:underline">
                          {b.fichier_nom}
                        </a>{" "}
                        · {taille(b.taille)} · déposé le {formaterDate(b.depose_le)} ·{" "}
                        <span title={`Empreinte SHA-256 : ${b.empreinte_sha256}`}>empreinte {b.empreinte_sha256.slice(0, 8)}…</span>
                      </p>
                    ) : (
                      <p className="text-sm text-doux">Aucun bulletin</p>
                    )}
                  </div>
                  {!b && <Badge teinte="ambre">Manquant</Badge>}
                  {b && !idsAttendus.has(s.id) && <Badge>Hors période</Badge>}
                  {modifiable && (
                    <div className="flex items-start gap-2">
                      <DepotUnique entrepriseId={id} periodeId={periodeId} salarieId={s.id} libelle={b ? "Remplacer" : "Déposer"} />
                      {b && (
                        <form action={retirerBulletin.bind(null, id, b.id)}>
                          <button type="submit" className={classesBouton("danger", "petit")} aria-label={`Retirer le bulletin de ${s.nom} ${s.prenoms}`} title="Retirer">
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </Page>
  );
}
