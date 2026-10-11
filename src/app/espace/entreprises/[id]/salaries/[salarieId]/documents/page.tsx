import type { Metadata } from "next";
import { FileImage, FileText, FolderOpen, Trash2 } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { CATEGORIES_DOCUMENT } from "@/lib/contrats/regles";
import { Champ, ChampFichier, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { EnTeteSalarie } from "../en-tete-salarie";
import { chargerDossier, lienFichier } from "../donnees";
import { ajouterDocument, supprimerDocument } from "../actions-dossier";

export const metadata: Metadata = { title: "Documents" };

const TAILLE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const taille = (octets: number) => (octets > 1024 * 1024 ? `${TAILLE.format(octets / 1024 / 1024)} Mo` : `${Math.ceil(octets / 1024)} Ko`);

export default async function PageDocuments({ params }: PageProps<"/espace/entreprises/[id]/salaries/[salarieId]/documents">) {
  const { id, salarieId } = await params;
  const { supabase, salarie, entreprise, modifiable } = await chargerDossier(id, salarieId);

  const [{ data: documents }, { data: contrats }] = await Promise.all([
    supabase
      .from("documents_salarie")
      .select("id, categorie, libelle, fichier_chemin, fichier_nom, taille, type_mime, cree_le")
      .eq("salarie_id", salarieId)
      .order("cree_le", { ascending: false }),
    supabase
      .from("contrats")
      .select("id, nature, type_contrat, date_debut, fichier_chemin, fichier_nom")
      .eq("salarie_id", salarieId)
      .not("fichier_chemin", "is", null)
      .order("date_debut", { ascending: false }),
  ]);

  return (
    <Page>
      <EnTeteSalarie entrepriseId={id} raisonSociale={entreprise.raison_sociale} salarie={salarie} onglet="documents" />

      <Carte titre="Documents du salarié" description="Stockés dans un espace privé, accessibles uniquement aux personnes habilitées." sansMarge>
        {!documents?.length && !contrats?.length ? (
          <EtatVide icone={FolderOpen} titre="Aucun document" texte={modifiable ? "Ajoutez la pièce d'identité, les diplômes, les attestations…" : undefined} />
        ) : (
          <ul className="divide-y divide-bordure">
            {(contrats ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <FileText size={20} className="shrink-0 text-marque" aria-hidden />
                <div className="min-w-0 flex-1">
                  <a href={lienFichier(c.fichier_chemin!)} target="_blank" rel="noopener" className="font-medium text-marque hover:underline">
                    {c.nature === "avenant" ? "Avenant" : "Contrat"} du {formaterDate(c.date_debut)}
                  </a>
                  <p className="truncate text-sm text-doux">{c.fichier_nom}</p>
                </div>
                <Badge>Contrat</Badge>
              </li>
            ))}
            {(documents ?? []).map((d) => {
              const Icone = d.type_mime.startsWith("image/") ? FileImage : FileText;
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Icone size={20} className="shrink-0 text-marque" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <a href={lienFichier(d.fichier_chemin)} target="_blank" rel="noopener" className="font-medium text-marque hover:underline">
                      {d.libelle}
                    </a>
                    <p className="truncate text-sm text-doux">
                      {d.fichier_nom} · {taille(d.taille)} · ajouté le {formaterDate(d.cree_le)}
                    </p>
                  </div>
                  <Badge>{CATEGORIES_DOCUMENT[d.categorie as keyof typeof CATEGORIES_DOCUMENT]}</Badge>
                  {modifiable && (
                    <form action={supprimerDocument.bind(null, id, d.id)}>
                      <button type="submit" className={classesBouton("danger", "petit")} aria-label={`Supprimer ${d.libelle}`} title="Supprimer">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {modifiable && (
        <Carte titre="Ajouter un document">
          <Formulaire action={ajouterDocument.bind(null, id, salarieId)} libelleBouton="Ajouter le document" colonnes={2}>
            <ChoixListe
              nom="categorie"
              libelle="Catégorie"
              requis
              options={Object.entries(CATEGORIES_DOCUMENT).map(([valeur, libelle]) => ({ valeur, libelle }))}
            />
            <Champ nom="libelle" libelle="Nom du document" requis aide="Exemple : Carte d'identité (recto-verso)" />
            <ChampFichier libelle="Fichier" requis />
          </Formulaire>
        </Carte>
      )}
    </Page>
  );
}
