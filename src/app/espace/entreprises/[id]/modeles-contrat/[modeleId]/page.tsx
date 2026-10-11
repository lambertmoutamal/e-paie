import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Copy } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { EditeurDocument } from "@/components/editeur-document";
import { Carte, classesBouton, EnTetePage, Page } from "@/components/ui";
import { enregistrerModele, personnaliserModele } from "../actions";
import { FormulaireModele } from "../formulaire-modele";

export const metadata: Metadata = { title: "Modèle de contrat" };

export default async function PageModele({ params }: PageProps<"/espace/entreprises/[id]/modeles-contrat/[modeleId]">) {
  const { id, modeleId } = await params;
  const { supabase } = await exigerUtilisateur();
  const [{ data: entreprise }, { data: modele }, { data: peutGerer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.from("modeles_contrat").select("id, entreprise_id, nom, categorie, type_contrat, contenu").eq("id", modeleId).maybeSingle(),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
  ]);
  if (!entreprise || !modele || (modele.entreprise_id !== null && modele.entreprise_id !== id)) notFound();
  const standard = modele.entreprise_id === null;
  const modifiable = peutGerer === true && !standard;

  return (
    <Page>
      <EnTetePage
        titre={modele.nom}
        description={standard ? "Modèle standard DématPaie (lecture seule)" : entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/modeles-contrat`, libelle: "Modèles de contrat" },
        ]}
        actions={
          standard &&
          peutGerer === true && (
            <form action={personnaliserModele.bind(null, id, modele.id)}>
              <button type="submit" className={classesBouton()}>
                <Copy size={16} aria-hidden />
                Personnaliser ce modèle
              </button>
            </form>
          )
        }
      />
      <Carte>
        {modifiable ? (
          <FormulaireModele action={enregistrerModele.bind(null, modele.id)} initial={modele} libelleBouton="Enregistrer le modèle" />
        ) : (
          <EditeurDocument contenuInitial={modele.contenu} lectureSeule />
        )}
      </Carte>
    </Page>
  );
}
