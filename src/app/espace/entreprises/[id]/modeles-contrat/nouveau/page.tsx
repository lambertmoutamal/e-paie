import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Carte, EnTetePage, Page } from "@/components/ui";
import { creerModele } from "../actions";
import { FormulaireModele } from "../formulaire-modele";

export const metadata: Metadata = { title: "Nouveau modèle de contrat" };

export default async function PageNouveauModele({ params }: PageProps<"/espace/entreprises/[id]/modeles-contrat/nouveau">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();
  const [{ data: entreprise }, { data: peutGerer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
  ]);
  if (!entreprise || peutGerer !== true) notFound();

  return (
    <Page>
      <EnTetePage
        titre="Nouveau modèle de contrat"
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/modeles-contrat`, libelle: "Modèles de contrat" },
        ]}
      />
      <Carte>
        <FormulaireModele
          action={creerModele.bind(null, id)}
          initial={{ nom: "", categorie: "contrat", type_contrat: null, contenu: "<h1 style=\"text-align: center\">CONTRAT DE TRAVAIL</h1><p></p>" }}
          libelleBouton="Créer le modèle"
        />
      </Carte>
    </Page>
  );
}
