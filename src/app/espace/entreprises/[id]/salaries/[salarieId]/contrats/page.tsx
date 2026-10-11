import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { FilePen, FilePlus2, FileText, Paperclip } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { formaterMontant, libelleTypeContrat, STATUTS_CONTRAT, TYPES_CONTRAT } from "@/lib/contrats/regles";
import { Champ, ChampFichier, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { EnTeteSalarie } from "../en-tete-salarie";
import { chargerDossier, lienFichier } from "../donnees";
import { activerContrat, ajouterAvenant, creerContrat, joindreContratSigne, renouvelerContrat, terminerContrat } from "../actions-dossier";

export const metadata: Metadata = { title: "Contrats" };

type Contrat = {
  id: string;
  contrat_parent_id: string | null;
  nature: "contrat" | "avenant" | "renouvellement";
  type_contrat: string;
  poste: string | null;
  categorie: string | null;
  salaire_base: number | null;
  devise: string;
  heures_hebdo: number | null;
  lieu_travail: string | null;
  date_debut: string;
  date_fin_prevue: string | null;
  fin_periode_essai: string | null;
  objet: string | null;
  statut: keyof typeof STATUTS_CONTRAT;
  date_fin_effective: string | null;
  motif_fin: string | null;
  fichier_chemin: string | null;
  fichier_nom: string | null;
  contenu: string | null;
  document_fige: boolean;
};

type Modele = { id: string; nom: string; categorie: string };

const OPTIONS_TYPE = Object.entries(TYPES_CONTRAT).map(([valeur, libelle]) => ({ valeur, libelle }));

export default async function PageContrats({ params }: PageProps<"/espace/entreprises/[id]/salaries/[salarieId]/contrats">) {
  const { id, salarieId } = await params;
  const { supabase, salarie, entreprise, modifiable } = await chargerDossier(id, salarieId);

  const { data } = await supabase
    .from("contrats")
    .select("id, contrat_parent_id, nature, type_contrat, poste, categorie, salaire_base, devise, heures_hebdo, lieu_travail, date_debut, date_fin_prevue, fin_periode_essai, objet, statut, date_fin_effective, motif_fin, fichier_chemin, fichier_nom, contenu, document_fige")
    .eq("salarie_id", salarieId)
    .order("date_debut", { ascending: false });
  const tous = (data ?? []) as Contrat[];
  const { data: modelesBruts } = await supabase
    .from("modeles_contrat")
    .select("id, nom, categorie")
    .eq("actif", true)
    .or(`entreprise_id.eq.${id},entreprise_id.is.null`)
    .order("nom");
  const modeles = (modelesBruts ?? []) as Modele[];
  const choixModele = (categorie: string, sansModele: string) => [
    { valeur: "aucun", libelle: sansModele },
    ...modeles.filter((m) => m.categorie === categorie).map((m) => ({ valeur: m.id, libelle: `Rédiger avec : ${m.nom}` })),
  ];
  const lienModeles = `/espace/entreprises/${id}/modeles-contrat`;
  const principaux = tous.filter((c) => c.nature !== "avenant");
  const avenantsDe = (contratId: string) => tous.filter((c) => c.nature === "avenant" && c.contrat_parent_id === contratId);
  const enCours = principaux.find((c) => c.statut === "en_cours");
  const brouillons = principaux.filter((c) => c.statut === "brouillon");
  const historique = principaux.filter((c) => c.statut === "termine" || c.statut === "rompu");

  return (
    <Page>
      <EnTeteSalarie entrepriseId={id} raisonSociale={entreprise.raison_sociale} salarie={salarie} onglet="contrats" />

      {enCours ? (
        <CarteContrat
          contrat={enCours}
          avenants={avenantsDe(enCours.id)}
          entrepriseId={id}
          salarieId={salarieId}
          modifiable={modifiable}
          principal
          choixAvenant={choixModele("avenant", "Aucun : je joins l'avenant signé (facultatif)")}
        />
      ) : (
        !brouillons.length && (
          <Carte>
            <EtatVide icone={FileText} titre="Aucun contrat en cours" texte={modifiable ? "Enregistrez le contrat de ce salarié ci-dessous." : undefined} />
          </Carte>
        )
      )}

      {brouillons.map((c) => (
        <CarteContrat key={c.id} contrat={c} avenants={[]} entrepriseId={id} salarieId={salarieId} modifiable={modifiable} choixAvenant={[]} />
      ))}

      {modifiable && !enCours && (
        <Carte titre="Nouveau contrat" description="Deux possibilités : importer le contrat déjà signé, ou le rédiger dans DématPaie à partir d'un modèle.">
          <ul className="mb-5 grid gap-2 text-sm sm:grid-cols-2">
            <li className="rounded-lg bg-black/[.03] px-3 py-2">
              <strong>Importer un contrat signé</strong> : remplissez les informations, laissez « Aucun » comme modèle et joignez le PDF ou la photo
              du contrat.
            </li>
            <li className="rounded-lg bg-marque-claire/60 px-3 py-2">
              <strong>Rédiger dans DématPaie</strong> : choisissez un modèle (statut « Brouillon » conseillé). Le texte est rempli automatiquement et
              l&apos;éditeur s&apos;ouvre.{" "}
              <Link href={lienModeles} className="font-medium text-marque hover:underline">
                Gérer les modèles
              </Link>
            </li>
          </ul>
          <Formulaire action={creerContrat.bind(null, id, salarieId)} libelleBouton="Enregistrer le contrat" colonnes={2}>
            <ChoixListe nom="modele_id" libelle="Modèle" requis pleineLargeur valeurInitiale="aucun" options={choixModele("contrat", "Aucun : j'importe le contrat signé")} />
            <ChoixListe nom="type_contrat" libelle="Type de contrat" requis options={OPTIONS_TYPE} valeurInitiale="cdi" />
            <ChoixListe
              nom="statut"
              libelle="Statut"
              requis
              valeurInitiale="en_cours"
              options={[
                { valeur: "en_cours", libelle: "En cours" },
                { valeur: "brouillon", libelle: "Brouillon (pas encore signé)" },
              ]}
            />
            <Champ nom="poste" libelle="Poste" requis valeurInitiale={salarie.poste} />
            <Champ nom="categorie" libelle="Catégorie / classification" />
            <Champ nom="salaire_base" libelle="Salaire de base mensuel (FCFA)" aide="Exemple : 350 000" />
            <Champ nom="heures_hebdo" libelle="Heures par semaine" aide="Exemple : 40" />
            <Champ nom="lieu_travail" libelle="Lieu de travail" pleineLargeur />
            <Champ nom="date_debut" libelle="Date de début" type="date" requis valeurInitiale={salarie.date_embauche} />
            <Champ nom="date_fin_prevue" libelle="Date de fin prévue" type="date" aide="Obligatoire sauf pour un CDI." />
            <Champ nom="fin_periode_essai" libelle="Fin de la période d'essai" type="date" />
            <ChampFichier libelle="Contrat signé (pour un import)" />
          </Formulaire>
        </Carte>
      )}

      {historique.length > 0 && (
        <Carte titre="Historique des contrats" sansMarge>
          <ul className="divide-y divide-bordure">
            {historique.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
                <div>
                  <p className="font-medium">
                    {libelleTypeContrat(c.type_contrat)}
                    {c.nature === "renouvellement" ? " (renouvellement)" : ""} · {c.poste ?? "—"}
                  </p>
                  <p className="text-doux">
                    Du {formaterDate(c.date_debut)} au {formaterDate(c.date_fin_effective!)} · {c.motif_fin}
                    {avenantsDe(c.id).length ? ` · ${avenantsDe(c.id).length} avenant(s)` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.fichier_chemin && (
                    <a href={lienFichier(c.fichier_chemin)} target="_blank" rel="noopener" className={classesBouton("discret", "petit")}>
                      <Paperclip size={14} aria-hidden /> PDF
                    </a>
                  )}
                  <Badge teinte={STATUTS_CONTRAT[c.statut].teinte}>{STATUTS_CONTRAT[c.statut].libelle}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </Page>
  );
}

function CarteContrat({
  contrat: c,
  avenants,
  entrepriseId,
  salarieId,
  modifiable,
  principal,
  choixAvenant,
}: {
  contrat: Contrat;
  avenants: Contrat[];
  entrepriseId: string;
  salarieId: string;
  modifiable: boolean;
  principal?: boolean;
  choixAvenant: { valeur: string; libelle: string }[];
}) {
  const lienDocument = (contratId: string) => `/espace/entreprises/${entrepriseId}/salaries/${salarieId}/contrats/${contratId}/document`;
  const statut = STATUTS_CONTRAT[c.statut];
  const lignes: [string, string][] = [
    ["Poste", c.poste ?? "—"],
    ["Catégorie", c.categorie ?? "—"],
    ["Salaire de base", formaterMontant(c.salaire_base, c.devise)],
    ["Temps de travail", c.heures_hebdo ? `${c.heures_hebdo} h / semaine` : "—"],
    ["Lieu de travail", c.lieu_travail ?? "—"],
    ["Début", formaterDate(c.date_debut)],
    ["Fin prévue", c.date_fin_prevue ? formaterDate(c.date_fin_prevue) : "Indéterminée"],
    ["Fin de période d'essai", c.fin_periode_essai ? formaterDate(c.fin_periode_essai) : "—"],
  ];

  return (
    <Carte
      titre={`${principal ? "Contrat en cours" : "Contrat"} : ${libelleTypeContrat(c.type_contrat)}${c.nature === "renouvellement" ? " (renouvelé)" : ""}`}
      action={<Badge teinte={statut.teinte}>{statut.libelle}</Badge>}
    >
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="flex justify-between gap-4 border-b border-bordure pb-2">
            <dt className="text-doux">{libelle}</dt>
            <dd className="text-right font-medium">{valeur}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {c.fichier_chemin ? (
          <a href={lienFichier(c.fichier_chemin)} target="_blank" rel="noopener" className={classesBouton("secondaire", "petit")}>
            <Paperclip size={14} aria-hidden /> Contrat signé : {c.fichier_nom}
          </a>
        ) : (
          <span className="text-doux">Aucun contrat signé joint.</span>
        )}
        <BoutonDocument contrat={c} href={lienDocument(c.id)} modifiable={modifiable} />
      </div>

      {avenants.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Avenants ({avenants.length})</p>
          <ul className="flex flex-col gap-2 text-sm">
            {avenants.map((a) => (
              <li key={a.id} className="rounded-lg bg-black/[.03] px-3 py-2">
                <span className="font-medium">À partir du {formaterDate(a.date_debut)}</span> : {a.objet}
                {a.salaire_base !== null && ` · salaire ${formaterMontant(a.salaire_base, a.devise)}`}
                {a.poste && ` · poste « ${a.poste} »`}
                {a.fichier_chemin && (
                  <a href={lienFichier(a.fichier_chemin)} target="_blank" rel="noopener" className="ml-2 font-medium text-marque">
                    PDF
                  </a>
                )}
                {(a.contenu || modifiable) && (
                  <Link href={lienDocument(a.id)} className="ml-2 font-medium text-marque">
                    {a.contenu ? (a.document_fige || !modifiable ? "Texte" : "Modifier le texte") : "Rédiger"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {modifiable && (
        <div className="mt-5 flex flex-col gap-3 border-t border-bordure pt-4">
          {c.statut === "brouillon" && (
            <form action={activerContrat.bind(null, entrepriseId, c.id)}>
              <button type="submit" className={classesBouton("principal", "petit")}>
                Passer « En cours » (contrat signé)
              </button>
            </form>
          )}

          <Action titre={c.fichier_chemin ? "Remplacer le contrat signé" : "Joindre le contrat signé"}>
            <Formulaire action={joindreContratSigne.bind(null, entrepriseId, salarieId, c.id)} libelleBouton="Enregistrer le fichier">
              <ChampFichier libelle="Contrat signé" requis />
            </Formulaire>
          </Action>

          {c.statut === "en_cours" && (
            <>
              <Action titre="Ajouter un avenant" icone>
                <Formulaire action={ajouterAvenant.bind(null, entrepriseId, salarieId, c.id)} libelleBouton="Enregistrer l'avenant" colonnes={2}>
                  <ChoixListe nom="modele_id" libelle="Modèle" requis pleineLargeur valeurInitiale="aucun" options={choixAvenant} />
                  <Champ nom="date_debut" libelle="Date d'effet" type="date" requis />
                  <Champ nom="objet" libelle="Objet" requis aide="Exemple : promotion, augmentation, changement d'horaires" />
                  <Champ nom="poste" libelle="Nouveau poste" aide="Laisser vide si inchangé" />
                  <Champ nom="categorie" libelle="Nouvelle catégorie" />
                  <Champ nom="salaire_base" libelle="Nouveau salaire de base (FCFA)" />
                  <Champ nom="heures_hebdo" libelle="Nouvelles heures par semaine" />
                  <Champ nom="lieu_travail" libelle="Nouveau lieu de travail" pleineLargeur />
                  <ChampFichier libelle="Avenant signé (facultatif)" />
                </Formulaire>
              </Action>

              {c.type_contrat !== "cdi" && (
                <Action titre="Renouveler le contrat">
                  <Formulaire action={renouvelerContrat.bind(null, entrepriseId, salarieId, c.id)} libelleBouton="Renouveler" colonnes={2}>
                    <Champ nom="date_debut" libelle="Début du renouvellement" type="date" requis valeurInitiale={lendemain(c.date_fin_prevue)} />
                    <Champ nom="date_fin_prevue" libelle="Nouvelle date de fin" type="date" requis />
                    <Champ nom="salaire_base" libelle="Salaire de base (FCFA)" aide="Laisser vide pour garder le même" pleineLargeur />
                  </Formulaire>
                </Action>
              )}

              <Action titre="Mettre fin au contrat" danger>
                <Formulaire action={terminerContrat.bind(null, entrepriseId, c.id)} libelleBouton="Enregistrer la fin du contrat" colonnes={2}>
                  <ChoixListe
                    nom="statut"
                    libelle="Type de fin"
                    requis
                    options={[
                      { valeur: "termine", libelle: "Fin normale (terme du contrat)" },
                      { valeur: "rompu", libelle: "Rupture anticipée" },
                    ]}
                  />
                  <Champ nom="date_fin_effective" libelle="Date de fin" type="date" requis valeurInitiale={c.date_fin_prevue} />
                  <Champ nom="motif_fin" libelle="Motif" requis pleineLargeur aide="Fin de CDD, démission, licenciement, rupture de période d'essai…" />
                </Formulaire>
              </Action>
            </>
          )}
        </div>
      )}
    </Carte>
  );
}

// Accès à la rédaction du contrat dans DématPaie (ou à son texte, une fois signé).
function BoutonDocument({ contrat: c, href, modifiable }: { contrat: Contrat; href: string; modifiable: boolean }) {
  const clos = c.statut === "termine" || c.statut === "rompu";
  if (!c.contenu && (!modifiable || clos)) return null;
  const libelle = !c.contenu ? "Rédiger le contrat dans DématPaie" : c.document_fige || !modifiable || clos ? "Voir le texte du contrat" : "Modifier le texte du contrat";
  return (
    <Link href={href} className={classesBouton(c.contenu ? "secondaire" : "discret", "petit")}>
      <FilePen size={14} aria-hidden />
      {libelle}
    </Link>
  );
}

// Volet repliable pour une action secondaire.
function Action({ titre, children, danger, icone }: { titre: string; children: ReactNode; danger?: boolean; icone?: boolean }) {
  return (
    <details className="rounded-lg border border-bordure p-3">
      <summary className={`cursor-pointer text-sm font-medium ${danger ? "text-red-700" : "text-marque"} inline-flex items-center gap-1`}>
        {icone && <FilePlus2 size={14} aria-hidden />}
        {titre}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function lendemain(date: string | null): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
