import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, Plus, UserRound } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { champLie, valeurLiee } from "@/lib/supabase/relations";
import { ActionEnLigne, Champ, Formulaire } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, LienBouton, Ligne, ListeLignes, Page } from "@/components/ui";
import { ajouterAdministrateur, renvoyerInvitationAdmin } from "../actions";

export const metadata: Metadata = { title: "Cabinet" };

export default async function PageCabinet({ params }: PageProps<"/espace/cabinets/[id]">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();

  // La RLS ne renvoie le cabinet qu'à l'admin plateforme et aux admins de ce cabinet.
  const { data: cabinet } = await supabase
    .from("cabinets")
    .select("id, nom, nif, telephone, email, adresse")
    .eq("id", id)
    .maybeSingle();
  if (!cabinet) notFound();

  const [{ data: admins }, { data: entreprises }] = await Promise.all([
    supabase.from("membres_cabinet").select("profil_id, profils(nom_complet, email, active_le)").eq("cabinet_id", id),
    supabase.from("entreprises").select("id, raison_sociale, statut, mode").eq("cabinet_id", id).order("raison_sociale"),
  ]);

  return (
    <Page>
      <EnTetePage
        titre={cabinet.nom}
        description={[cabinet.nif && `NIF ${cabinet.nif}`, cabinet.telephone, cabinet.email, cabinet.adresse].filter(Boolean).join(" · ") || undefined}
        fil={[{ href: "/espace", libelle: "Tableau de bord" }, { href: "/espace/cabinets", libelle: "Cabinets" }]}
        actions={
          <LienBouton href={`/espace/entreprises/nouvelle?cabinet=${cabinet.id}`} icone={Plus}>
            Nouvelle entreprise
          </LienBouton>
        }
      />

      <Carte titre={`Entreprises clientes (${entreprises?.length ?? 0})`} sansMarge>
        {!entreprises?.length ? (
          <EtatVide icone={Briefcase} titre="Aucune entreprise" texte="Ajoutez la première entreprise cliente de ce cabinet." />
        ) : (
          <ListeLignes>
            {entreprises.map((e) => (
              <Ligne
                key={e.id}
                href={`/espace/entreprises/${e.id}`}
                icone={Briefcase}
                titre={e.raison_sociale}
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

      <Carte titre="Administrateurs du cabinet" description="Ils gèrent toutes les entreprises de ce cabinet." sansMarge>
        {!admins?.length ? (
          <EtatVide icone={UserRound} titre="Aucun administrateur" />
        ) : (
          <ListeLignes>
            {admins.map((a) => {
              const enAttente = valeurLiee(a.profils, "active_le") === null;
              return (
                <Ligne
                  key={a.profil_id}
                  icone={UserRound}
                  titre={champLie(a.profils, "nom_complet")}
                  sousTitre={champLie(a.profils, "email")}
                  fin={
                    enAttente ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge teinte="ambre">Invitation en attente</Badge>
                        <ActionEnLigne action={renvoyerInvitationAdmin.bind(null, cabinet.id, a.profil_id)} libelle="Renvoyer" variante="discret" />
                      </div>
                    ) : (
                      <Badge teinte="vert">Actif</Badge>
                    )
                  }
                />
              );
            })}
          </ListeLignes>
        )}
        <div className="border-t border-bordure p-4 sm:p-5">
          <p className="mb-3 font-semibold">Ajouter un administrateur</p>
          <Formulaire action={ajouterAdministrateur.bind(null, cabinet.id)} libelleBouton="Envoyer l'invitation" colonnes={2}>
            <Champ nom="nom_complet" libelle="Nom complet" requis />
            <Champ nom="email" libelle="Email" type="email" requis />
          </Formulaire>
        </div>
      </Carte>
    </Page>
  );
}
