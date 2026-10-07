import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, Chargement, EnTete, PageEspace, Section, Vide } from "@/components/mise-en-page";
import { creerCabinet } from "./actions";

export const metadata: Metadata = { title: "Cabinets" };

export default function PageCabinets() {
  return (
    <PageEspace>
      <EnTete titre="Cabinets" retour={{ href: "/espace", libelle: "Mon espace" }} />
      <Suspense fallback={<Chargement />}>
        <ListeCabinets />
      </Suspense>
    </PageEspace>
  );
}

async function ListeCabinets() {
  const { supabase } = await exigerUtilisateur();
  if (!(await estAdminPlateforme(supabase))) notFound();

  const { data: cabinets } = await supabase
    .from("cabinets")
    .select("id, nom, email, entreprises(count)")
    .order("nom");

  return (
    <>
      <Section titre={`Tous les cabinets (${cabinets?.length ?? 0})`}>
        {!cabinets?.length ? (
          <Vide>Aucun cabinet pour le moment. Créez le premier ci-dessous.</Vide>
        ) : (
          <ul className="flex flex-col gap-2">
            {cabinets.map((c) => (
              <li key={c.id}>
                <Link href={`/espace/cabinets/${c.id}`} className="block rounded-xl border border-black/10 bg-white p-4">
                  <p className="font-semibold">{c.nom}</p>
                  <p className="text-sm text-foreground/70">
                    {nombre(c.entreprises)} entreprise(s){c.email ? ` · ${c.email}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre="Nouveau cabinet">
        <Carte>
          <Formulaire action={creerCabinet} libelleBouton="Créer le cabinet">
            <Champ nom="nom" libelle="Nom du cabinet" requis />
            <Champ nom="nif" libelle="NIF" />
            <Champ nom="telephone" libelle="Téléphone" type="tel" />
            <Champ nom="email" libelle="Email du cabinet" type="email" />
            <Champ nom="adresse" libelle="Adresse" />
            <p className="pt-2 text-sm font-semibold">Premier administrateur du cabinet (facultatif)</p>
            <Champ nom="admin_nom" libelle="Nom complet" />
            <Champ
              nom="admin_email"
              libelle="Email"
              type="email"
              aide="Un compte sera créé avec un mot de passe provisoire s'il n'existe pas déjà."
            />
          </Formulaire>
        </Carte>
      </Section>
    </>
  );
}

function nombre(agregat: unknown): number {
  return (Array.isArray(agregat) ? agregat[0]?.count : 0) ?? 0;
}
