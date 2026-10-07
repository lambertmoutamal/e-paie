import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { ChoixListe, Formulaire } from "@/components/formulaire";
import { Carte, EnTetePage, EtatVide, Page } from "@/components/ui";
import { creerEntreprise } from "../actions";
import { ChampsEntreprise } from "../champs-entreprise";

export const metadata: Metadata = { title: "Nouvelle entreprise" };

export default async function PageNouvelleEntreprise({ searchParams }: PageProps<"/espace/entreprises/nouvelle">) {
  const { cabinet } = await searchParams;
  const { supabase, utilisateur } = await exigerUtilisateur();
  const { adminPlateforme } = await droitsUtilisateur();

  // Cabinets dans lesquels la personne peut créer une entreprise.
  const { data: cabinets } = adminPlateforme
    ? await supabase.from("cabinets").select("id, nom").order("nom")
    : await supabase
        .from("cabinets")
        .select("id, nom, membres_cabinet!inner(profil_id)")
        .eq("membres_cabinet.profil_id", utilisateur.id)
        .order("nom");

  const cabinetParDefaut =
    typeof cabinet === "string" && cabinets?.some((c) => c.id === cabinet)
      ? cabinet
      : cabinets?.length === 1
        ? cabinets[0].id
        : undefined;

  return (
    <Page>
      <EnTetePage
        titre="Nouvelle entreprise"
        description="Créez la fiche d'une entreprise cliente."
        fil={[
          { href: "/espace", libelle: "Tableau de bord" },
          { href: "/espace/entreprises", libelle: "Entreprises" },
        ]}
      />
      <Carte>
        {!cabinets?.length ? (
          <EtatVide icone={Building2} titre="Création impossible" texte="Vous n'administrez aucun cabinet." />
        ) : (
          <Formulaire action={creerEntreprise} libelleBouton="Créer l'entreprise" colonnes={2}>
            <ChoixListe
              nom="cabinet_id"
              libelle="Cabinet"
              requis
              pleineLargeur
              valeurInitiale={cabinetParDefaut}
              options={cabinets.map((c) => ({ valeur: c.id, libelle: c.nom }))}
            />
            <ChampsEntreprise />
          </Formulaire>
        )}
      </Carte>
    </Page>
  );
}
