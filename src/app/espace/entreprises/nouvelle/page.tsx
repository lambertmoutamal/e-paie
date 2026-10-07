import type { Metadata } from "next";
import { Suspense } from "react";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { ChoixListe, Formulaire } from "@/components/formulaire";
import { Carte, Chargement, EnTete, PageEspace, Vide } from "@/components/mise-en-page";
import { creerEntreprise } from "../actions";
import { ChampsEntreprise } from "../champs-entreprise";

export const metadata: Metadata = { title: "Nouvelle entreprise" };

export default function PageNouvelleEntreprise({ searchParams }: PageProps<"/espace/entreprises/nouvelle">) {
  return (
    <PageEspace>
      <EnTete titre="Nouvelle entreprise" retour={{ href: "/espace/entreprises", libelle: "Entreprises" }} />
      <Suspense fallback={<Chargement />}>
        <FormulaireCreation searchParams={searchParams} />
      </Suspense>
    </PageEspace>
  );
}

async function FormulaireCreation({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cabinet } = await searchParams;
  const { supabase, utilisateur } = await exigerUtilisateur();

  // Cabinets dans lesquels la personne peut créer une entreprise.
  const adminPlateforme = await estAdminPlateforme(supabase);
  const { data: cabinets } = adminPlateforme
    ? await supabase.from("cabinets").select("id, nom").order("nom")
    : await supabase
        .from("cabinets")
        .select("id, nom, membres_cabinet!inner(profil_id)")
        .eq("membres_cabinet.profil_id", utilisateur.id)
        .order("nom");

  if (!cabinets?.length) {
    return <Vide>Vous n&apos;administrez aucun cabinet : vous ne pouvez pas créer d&apos;entreprise.</Vide>;
  }

  const cabinetParDefaut =
    typeof cabinet === "string" && cabinets.some((c) => c.id === cabinet)
      ? cabinet
      : cabinets.length === 1
        ? cabinets[0].id
        : undefined;

  return (
    <Carte>
      <Formulaire action={creerEntreprise} libelleBouton="Créer l'entreprise">
        <ChoixListe
          nom="cabinet_id"
          libelle="Cabinet"
          requis
          valeurInitiale={cabinetParDefaut}
          options={cabinets.map((c) => ({ valeur: c.id, libelle: c.nom }))}
        />
        <ChampsEntreprise />
      </Formulaire>
    </Carte>
  );
}
