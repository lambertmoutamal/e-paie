import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Formulaire } from "@/components/formulaire";
import { Carte, EnTetePage, Page } from "@/components/ui";
import { creerSalarie } from "../actions";
import { ChampsSalarie } from "../champs-salarie";

export const metadata: Metadata = { title: "Nouveau salarié" };

export default async function PageNouveauSalarie({ params }: PageProps<"/espace/entreprises/[id]/salaries/nouveau">) {
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
        titre="Nouveau salarié"
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/salaries`, libelle: "Salariés" },
        ]}
      />
      <Carte>
        <Formulaire action={creerSalarie.bind(null, id)} libelleBouton="Créer la fiche" colonnes={2}>
          <ChampsSalarie />
        </Formulaire>
      </Carte>
    </Page>
  );
}
