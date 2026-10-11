import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, FilePen, FileText, Info, Plus } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { CATEGORIES_MODELE, libelleTypeContrat } from "@/lib/contrats/regles";
import { Badge, Carte, classesBouton, EnTetePage, EtatVide, LienBouton, Page } from "@/components/ui";
import { basculerModele, personnaliserModele } from "./actions";

export const metadata: Metadata = { title: "Modèles de contrat" };

export default async function PageModeles({ params }: PageProps<"/espace/entreprises/[id]/modeles-contrat">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();
  const [{ data: entreprise }, { data: modeles }, { data: peutGerer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.from("modeles_contrat").select("id, entreprise_id, nom, categorie, type_contrat, actif, modifie_le").order("categorie").order("nom"),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
  ]);
  if (!entreprise) notFound();
  const standards = (modeles ?? []).filter((m) => m.entreprise_id === null);
  const propres = (modeles ?? []).filter((m) => m.entreprise_id === id);
  const modifiable = peutGerer === true;

  return (
    <Page>
      <EnTetePage
        titre="Modèles de contrat"
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/salaries`, libelle: "Salariés" },
        ]}
        actions={
          modifiable && (
            <LienBouton href={`/espace/entreprises/${id}/modeles-contrat/nouveau`} icone={Plus}>
              Nouveau modèle
            </LienBouton>
          )
        }
      />

      <Carte titre="Modèles de l'entreprise" description="Vos modèles : créés ici, importés depuis Word ou personnalisés à partir d'un modèle standard." sansMarge>
        {!propres.length ? (
          <EtatVide
            icone={FilePen}
            titre="Aucun modèle pour l'instant"
            texte={modifiable ? "Personnalisez un modèle standard ci-dessous, ou créez le vôtre (vous pouvez importer un document Word)." : undefined}
          />
        ) : (
          <ul className="divide-y divide-bordure">
            {propres.map((m) => (
              <li key={m.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${m.actif ? "" : "opacity-60"}`}>
                <FileText size={18} className="shrink-0 text-marque" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link href={`/espace/entreprises/${id}/modeles-contrat/${m.id}`} className="font-medium text-marque hover:underline">
                    {m.nom}
                  </Link>
                  <p className="text-xs text-doux">Modifié le {formaterDate(m.modifie_le)}</p>
                </div>
                <Badge>{CATEGORIES_MODELE[m.categorie as keyof typeof CATEGORIES_MODELE]}</Badge>
                {m.type_contrat && <Badge teinte="bleu">{libelleTypeContrat(m.type_contrat)}</Badge>}
                {!m.actif && <Badge>Désactivé</Badge>}
                {modifiable && (
                  <form action={basculerModele.bind(null, m.id, !m.actif)}>
                    <button type="submit" className={classesBouton("secondaire", "petit")}>
                      {m.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre="Modèles standard DématPaie" sansMarge>
        <p className="flex items-start gap-2 border-b border-bordure bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          Modèles génériques fournis à titre indicatif : adaptez-les et faites-les valider par un juriste au regard du droit du travail et de la
          convention collective applicables.
        </p>
        <ul className="divide-y divide-bordure">
          {standards.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <FileText size={18} className="shrink-0 text-doux" aria-hidden />
              <Link href={`/espace/entreprises/${id}/modeles-contrat/${m.id}`} className="min-w-0 flex-1 font-medium hover:text-marque">
                {m.nom}
              </Link>
              <Badge>{CATEGORIES_MODELE[m.categorie as keyof typeof CATEGORIES_MODELE]}</Badge>
              {modifiable && (
                <form action={personnaliserModele.bind(null, id, m.id)}>
                  <button type="submit" className={classesBouton("secondaire", "petit")}>
                    <Copy size={14} aria-hidden />
                    Personnaliser
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Carte>
    </Page>
  );
}
