import type { Metadata } from "next";
import { Briefcase, Plus } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { champLie } from "@/lib/supabase/relations";
import { Badge, Carte, EnTetePage, EtatVide, LienBouton, Ligne, ListeLignes, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Entreprises" };

export default async function PageEntreprises() {
  const { supabase } = await exigerUtilisateur();
  const { adminPlateforme, cabinets } = await droitsUtilisateur();
  const peutCreer = adminPlateforme || cabinets.length > 0;

  // La RLS ne renvoie que les entreprises auxquelles la personne a accès.
  const { data: entreprises } = await supabase
    .from("entreprises")
    .select("id, raison_sociale, statut, mode, nif, cabinets(nom)")
    .order("raison_sociale");

  return (
    <Page>
      <EnTetePage
        titre="Entreprises"
        description="Les entreprises auxquelles vous avez accès."
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
        actions={
          peutCreer && (
            <LienBouton href="/espace/entreprises/nouvelle" icone={Plus}>
              Nouvelle entreprise
            </LienBouton>
          )
        }
      />

      <Carte titre={`${entreprises?.length ?? 0} entreprise(s)`} sansMarge>
        {!entreprises?.length ? (
          <EtatVide
            icone={Briefcase}
            titre="Aucune entreprise"
            texte={peutCreer ? "Créez votre première entreprise cliente." : "Aucune entreprise ne vous est encore affectée."}
          />
        ) : (
          <ListeLignes>
            {entreprises.map((e) => (
              <Ligne
                key={e.id}
                href={`/espace/entreprises/${e.id}`}
                icone={Briefcase}
                titre={e.raison_sociale}
                sousTitre={[e.cabinets ? champLie(e.cabinets, "nom") : "Sans cabinet", e.nif && `NIF ${e.nif}`].filter(Boolean).join(" · ")}
                fin={
                  <>
                    {e.statut === "archivee" && <Badge>Archivée</Badge>}
                    <Badge teinte={e.mode === "autonome" ? "bleu" : "vert"}>{e.mode === "autonome" ? "Autonome" : "Cabinet"}</Badge>
                  </>
                }
              />
            ))}
          </ListeLignes>
        )}
      </Carte>
    </Page>
  );
}
