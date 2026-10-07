import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, Chargement, EnTete, PageEspace, Section } from "@/components/mise-en-page";
import { modifierProfil } from "./actions";

export const metadata: Metadata = { title: "Mon profil" };

export default function PageProfil() {
  return (
    <PageEspace>
      <EnTete titre="Mon profil" retour={{ href: "/espace", libelle: "Mon espace" }} />
      <Suspense fallback={<Chargement />}>
        <FormulaireProfil />
      </Suspense>
    </PageEspace>
  );
}

async function FormulaireProfil() {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const { data: profil } = await supabase
    .from("profils")
    .select("nom_complet, email")
    .eq("id", utilisateur.id)
    .single();

  return (
    <>
      <Section titre="Informations">
        <Carte>
          <Formulaire action={modifierProfil} libelleBouton="Enregistrer">
            <Champ nom="nom_complet" libelle="Nom complet" requis valeurInitiale={profil?.nom_complet} />
            <Champ nom="email" libelle="Email" type="email" valeurInitiale={profil?.email} desactive aide="L'email ne peut être changé que par un administrateur." />
          </Formulaire>
        </Carte>
      </Section>
      <Section titre="Sécurité">
        <Link href="/espace/mot-de-passe" className="self-start rounded-lg border border-black/20 bg-white px-4 py-2 font-medium">
          Changer mon mot de passe
        </Link>
      </Section>
    </>
  );
}
