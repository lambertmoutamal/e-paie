import type { Metadata } from "next";
import { Briefcase, Building2 } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { champLie } from "@/lib/supabase/relations";
import { Badge, Carte, EnTetePage, EtatVide, Ligne, ListeLignes, Page, classesBouton } from "@/components/ui";
import { ouvrirMonCabinet } from "./actions";

export const metadata: Metadata = { title: "Entreprises" };

export default async function PageEntreprises({ searchParams }: { searchParams: Promise<{ "mon-cabinet"?: string }> }) {
  const { supabase } = await exigerUtilisateur();
  const { adminPlateforme, cabinets } = await droitsUtilisateur();
  const peutCreer = adminPlateforme || cabinets.length > 0;
  const refus = (await searchParams)["mon-cabinet"] === "refuse";

  // La RLS ne renvoie que les entreprises auxquelles la personne a accès.
  const { data: liste } = await supabase
    .from("entreprises")
    .select("id, raison_sociale, statut, mode, nif, interne_cabinet, cabinet_id, cabinets(nom)")
    .order("raison_sociale");
  // « Mon cabinet » en tête de liste
  const entreprises = [...(liste ?? [])].sort((a, b) => Number(b.interne_cabinet) - Number(a.interne_cabinet));
  // Cabinets administrés qui n'ont pas encore leur espace « Mon cabinet »
  const sansEspaceInterne = cabinets.filter((c) => !entreprises.some((e) => e.interne_cabinet && e.cabinet_id === c.cabinet_id));

  return (
    <Page>
      <EnTetePage
        titre="Entreprises"
        description="Les entreprises auxquelles vous avez accès."
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />

      {(sansEspaceInterne.length > 0 || refus) && (
        <Carte
          titre="Mon cabinet : la paie de vos propres employés"
          description="Gérez vos salariés, contrats, congés et bulletins comme pour une entreprise cliente. Inclus dans l'abonnement du cabinet."
        >
          {refus && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              L&apos;espace « Mon cabinet » n&apos;a pas pu être ouvert : seul un administrateur du cabinet peut le créer.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {sansEspaceInterne.map((c) => (
              <form key={c.cabinet_id} action={ouvrirMonCabinet.bind(null, c.cabinet_id)}>
                <button type="submit" className={classesBouton("principal")}>
                  <Building2 size={16} aria-hidden />
                  {cabinets.length > 1 ? `Créer l'espace de ${champLie(c.cabinets, "nom")}` : "Créer l'espace « Mon cabinet »"}
                </button>
              </form>
            ))}
          </div>
        </Carte>
      )}

      <Carte titre={`${entreprises.length} entreprise(s)`} sansMarge>
        {!entreprises.length ? (
          <EtatVide
            icone={Briefcase}
            titre="Aucune entreprise"
            texte={peutCreer ? "Ajoutez une entreprise depuis la page de connexion : « Créer une nouvelle entreprise »." : "Aucune entreprise ne vous est encore affectée."}
          />
        ) : (
          <ListeLignes>
            {entreprises.map((e) => (
              <Ligne
                key={e.id}
                href={`/espace/entreprises/${e.id}`}
                icone={e.interne_cabinet ? Building2 : Briefcase}
                titre={e.raison_sociale}
                sousTitre={[
                  e.interne_cabinet ? "Vos propres employés" : e.cabinets ? champLie(e.cabinets, "nom") : "Sans cabinet",
                  e.nif && `NIF ${e.nif}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                fin={
                  <>
                    {e.statut === "archivee" && <Badge>Archivée</Badge>}
                    {e.interne_cabinet ? (
                      <Badge teinte="ambre">Mon cabinet</Badge>
                    ) : (
                      <Badge teinte={e.mode === "autonome" ? "bleu" : "vert"}>{e.mode === "autonome" ? "Autonome" : "Cabinet"}</Badge>
                    )}
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
