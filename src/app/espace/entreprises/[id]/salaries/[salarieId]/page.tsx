import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogOut, RotateCcw } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { Champ, Formulaire } from "@/components/formulaire";
import { Badge, Carte, classesBouton, EnTetePage, Page } from "@/components/ui";
import { enregistrerSortie, modifierSalarie, reintegrerSalarie } from "../actions";
import { ChampsSalarie } from "../champs-salarie";

export const metadata: Metadata = { title: "Fiche salarié" };

export default async function PageSalarie({ params }: PageProps<"/espace/entreprises/[id]/salaries/[salarieId]">) {
  const { id, salarieId } = await params;
  const { supabase } = await exigerUtilisateur();

  // La RLS ne renvoie la fiche qu'aux personnes ayant accès à l'entreprise.
  const [{ data: salarie }, { data: entreprise }, { data: peutGerer }] = await Promise.all([
    supabase
      .from("salaries")
      .select("id, matricule, nom, prenoms, sexe, date_naissance, nationalite, poste, date_embauche, telephone, email, adresse, numero_cnss, banque, numero_compte, statut, date_sortie, motif_sortie, modifie_le")
      .eq("id", salarieId)
      .eq("entreprise_id", id)
      .maybeSingle(),
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
  ]);
  if (!salarie || !entreprise) notFound();
  const modifiable = peutGerer === true;
  const sorti = salarie.statut === "sorti";

  return (
    <Page>
      <EnTetePage
        titre={`${salarie.nom} ${salarie.prenoms}`}
        description={`Matricule ${salarie.matricule}${salarie.poste ? ` · ${salarie.poste}` : ""} · mis à jour le ${formaterDate(salarie.modifie_le)}`}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/salaries`, libelle: "Salariés" },
        ]}
        actions={sorti ? <Badge>Sorti(e) le {formaterDate(salarie.date_sortie!)}</Badge> : <Badge teinte="vert">En poste</Badge>}
      />

      {sorti && (
        <p className="rounded-lg border border-bordure bg-surface px-4 py-3 text-sm">
          <strong>Sortie du personnel</strong> le {formaterDate(salarie.date_sortie!)} : {salarie.motif_sortie}
        </p>
      )}

      <Carte titre="Fiche salarié" description={modifiable ? undefined : "Consultation seule."}>
        {modifiable ? (
          <Formulaire action={modifierSalarie.bind(null, id, salarie.id)} libelleBouton="Enregistrer" colonnes={2}>
            <ChampsSalarie fiche={salarie} />
          </Formulaire>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampsSalarie fiche={salarie} lectureSeule />
          </div>
        )}
      </Carte>

      {modifiable && !sorti && (
        <details className="rounded-xl border border-bordure bg-surface p-4">
          <summary className={`${classesBouton("danger", "petit")} cursor-pointer list-none`}>
            <LogOut size={14} aria-hidden /> Enregistrer une sortie du personnel
          </summary>
          <div className="mt-4">
            <p className="mb-4 text-sm text-doux">
              Le salarié n&apos;est pas supprimé : sa fiche et son historique restent consultables.
            </p>
            <Formulaire action={enregistrerSortie.bind(null, id, salarie.id)} libelleBouton="Confirmer la sortie" colonnes={2}>
              <Champ nom="date_sortie" libelle="Date de sortie" type="date" requis />
              <Champ nom="motif_sortie" libelle="Motif" requis aide="Démission, fin de CDD, licenciement, retraite…" />
            </Formulaire>
          </div>
        </details>
      )}

      {modifiable && sorti && (
        <form action={reintegrerSalarie.bind(null, id, salarie.id)}>
          <button type="submit" className={classesBouton("secondaire", "petit")}>
            <RotateCcw size={14} aria-hidden /> Réintégrer ce salarié
          </button>
        </form>
      )}
    </Page>
  );
}
