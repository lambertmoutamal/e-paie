import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Champ, Formulaire, TitreGroupe } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, Ligne, ListeLignes, Page } from "@/components/ui";
import { creerCabinet } from "./actions";

export const metadata: Metadata = { title: "Cabinets" };

export default async function PageCabinets() {
  const { supabase } = await exigerUtilisateur();
  if (!(await estAdminPlateforme(supabase))) notFound();

  const { data: cabinets } = await supabase
    .from("cabinets")
    .select("id, nom, email, telephone, entreprises(count)")
    .order("nom");

  return (
    <Page>
      <EnTetePage
        titre="Cabinets"
        description="Les cabinets comptables clients de la plateforme."
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />

      <Carte titre={`Tous les cabinets (${cabinets?.length ?? 0})`} sansMarge>
        {!cabinets?.length ? (
          <EtatVide icone={Building2} titre="Aucun cabinet" texte="Créez le premier cabinet avec le formulaire ci-dessous." />
        ) : (
          <ListeLignes>
            {cabinets.map((c) => (
              <Ligne
                key={c.id}
                href={`/espace/cabinets/${c.id}`}
                icone={Building2}
                titre={c.nom}
                sousTitre={[c.email, c.telephone].filter(Boolean).join(" · ") || "Coordonnées non renseignées"}
                fin={<Badge>{nombre(c.entreprises)} entreprise(s)</Badge>}
              />
            ))}
          </ListeLignes>
        )}
      </Carte>

      <div id="nouveau" className="scroll-mt-20">
        <Carte titre="Nouveau cabinet" description="Le premier administrateur recevra une invitation par email.">
          <Formulaire action={creerCabinet} libelleBouton="Créer le cabinet" colonnes={2}>
            <Champ nom="nom" libelle="Nom du cabinet" requis pleineLargeur />
            <Champ nom="nif" libelle="NIF" />
            <Champ nom="telephone" libelle="Téléphone" type="tel" />
            <Champ nom="email" libelle="Email du cabinet" type="email" />
            <Champ nom="adresse" libelle="Adresse" />
            <TitreGroupe>Premier administrateur du cabinet (facultatif)</TitreGroupe>
            <Champ nom="admin_nom" libelle="Nom complet" />
            <Champ nom="admin_email" libelle="Email" type="email" aide="Une invitation lui sera envoyée." />
          </Formulaire>
        </Carte>
      </div>
    </Page>
  );
}

function nombre(agregat: unknown): number {
  return (Array.isArray(agregat) ? agregat[0]?.count : 0) ?? 0;
}
