import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FilePen, FileText, Lock, Paperclip } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { libelleTypeContrat } from "@/lib/contrats/regles";
import { EditeurDocument } from "@/components/editeur-document";
import { Badge, Carte, classesBouton, Page } from "@/components/ui";
import { EnTeteSalarie } from "../../../en-tete-salarie";
import { chargerDossier, lienFichier } from "../../../donnees";
import { commencerDocument, enregistrerDocument, figerDocument, recommencerDocument } from "./actions";
import { FormulaireDocument } from "./formulaire-document";

export const metadata: Metadata = { title: "Rédaction du contrat" };

export default async function PageDocument({ params }: PageProps<"/espace/entreprises/[id]/salaries/[salarieId]/contrats/[contratId]/document">) {
  const { id, salarieId, contratId } = await params;
  const { supabase, salarie, entreprise, modifiable } = await chargerDossier(id, salarieId);

  const { data: contrat } = await supabase
    .from("contrats")
    .select("id, nature, type_contrat, date_debut, objet, statut, contenu, document_fige, fichier_chemin, fichier_nom")
    .eq("id", contratId)
    .eq("salarie_id", salarieId)
    .maybeSingle();
  if (!contrat) notFound();

  const categorie = contrat.nature === "avenant" ? "avenant" : "contrat";
  const { data: modeles } = await supabase
    .from("modeles_contrat")
    .select("id, entreprise_id, nom, type_contrat")
    .eq("categorie", categorie)
    .eq("actif", true)
    .or(`entreprise_id.eq.${id},entreprise_id.is.null`)
    .order("nom");
  // Modèles de l'entreprise d'abord, puis modèles standard ; ceux du bon type de contrat en tête
  const tries = (modeles ?? []).sort(
    (a, b) =>
      Number(a.entreprise_id === null) - Number(b.entreprise_id === null) ||
      Number(b.type_contrat === contrat.type_contrat) - Number(a.type_contrat === contrat.type_contrat),
  );

  const clos = contrat.statut === "termine" || contrat.statut === "rompu";
  const editable = modifiable && !contrat.document_fige && !clos;
  const titre = `${contrat.nature === "avenant" ? `Avenant du ${formaterDate(contrat.date_debut)}` : `Contrat ${libelleTypeContrat(contrat.type_contrat)}`}`;
  const retour = `/espace/entreprises/${id}/salaries/${salarieId}/contrats`;

  return (
    <Page>
      <EnTeteSalarie entrepriseId={id} raisonSociale={entreprise.raison_sociale} salarie={salarie} onglet="contrats" />
      <Link href={retour} className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline">
        <ChevronLeft size={16} aria-hidden />
        Retour aux contrats
      </Link>

      <Carte
        titre={`Document : ${titre}`}
        description={contrat.objet ?? undefined}
        action={
          contrat.document_fige ? (
            <Badge teinte="vert">
              <Lock size={12} className="mr-1" aria-hidden />
              Version signée
            </Badge>
          ) : contrat.contenu ? (
            <Badge teinte="ambre">Brouillon</Badge>
          ) : undefined
        }
      >
        {contrat.fichier_chemin && (
          <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <a href={lienFichier(contrat.fichier_chemin)} target="_blank" rel="noopener" className={classesBouton("secondaire", "petit")}>
              <Paperclip size={14} aria-hidden />
              {contrat.fichier_nom}
            </a>
          </p>
        )}

        {!contrat.contenu ? (
          editable ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-doux">
                Choisissez un modèle : le texte sera rempli automatiquement avec les informations du salarié et du contrat, puis vous pourrez
                l&apos;ajuster.{" "}
                <Link href={`/espace/entreprises/${id}/modeles-contrat`} className="font-medium text-marque hover:underline">
                  Gérer les modèles
                </Link>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {tries.map((m) => (
                  <li key={m.id}>
                    <form action={commencerDocument.bind(null, contrat.id, m.id)}>
                      <button
                        type="submit"
                        className="flex w-full items-start gap-3 rounded-xl border border-bordure p-3 text-left hover:border-marque/50 hover:bg-marque-claire/40"
                      >
                        <FileText size={18} className="mt-0.5 shrink-0 text-marque" aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-medium">{m.nom}</span>
                          <span className="block text-xs text-doux">{m.entreprise_id ? "Modèle de l'entreprise" : "Modèle standard e-Paie"}</span>
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
                <li>
                  <form action={commencerDocument.bind(null, contrat.id, null)}>
                    <button type="submit" className="flex w-full items-center gap-3 rounded-xl border border-dashed border-bordure p-3 text-left hover:border-marque/50">
                      <FilePen size={18} className="shrink-0 text-doux" aria-hidden />
                      <span className="font-medium">Page blanche</span>
                    </button>
                  </form>
                </li>
              </ul>
            </div>
          ) : (
            <p className="text-sm text-doux">Aucun document rédigé dans e-Paie pour ce {categorie}.</p>
          )
        ) : editable ? (
          <div className="flex flex-col gap-4">
            <FormulaireDocument action={enregistrerDocument.bind(null, id, salarieId, contrat.id)} contenu={contrat.contenu} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-4 text-sm">
              <form action={recommencerDocument.bind(null, contrat.id)}>
                <button type="submit" className="font-medium text-doux hover:text-foreground hover:underline">
                  Repartir d&apos;un autre modèle (le texte actuel sera effacé)
                </button>
              </form>
              <form action={figerDocument.bind(null, contrat.id)}>
                <button type="submit" className={classesBouton("secondaire", "petit")}>
                  <Lock size={14} aria-hidden />
                  Marquer comme version signée
                </button>
              </form>
            </div>
          </div>
        ) : (
          <EditeurDocument contenuInitial={contrat.contenu} lectureSeule />
        )}
      </Carte>
    </Page>
  );
}
