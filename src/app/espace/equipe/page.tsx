import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, UserRound, Users } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie, valeurLiee } from "@/lib/supabase/relations";
import { ROLES_EQUIPE_CABINET } from "@/lib/validation/schemas";
import { ActionEnLigne, CaseACocher, Champ, ChoixListe, Formulaire, TitreGroupe } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, Ligne, ListeLignes, Page, classesBouton } from "@/components/ui";
import { changerAcces, renvoyerInvitationEntreprise } from "../entreprises/actions";
import { renvoyerInvitationAdmin } from "../cabinets/actions";
import { affecterMembreEquipe, ajouterAdminEquipe, retirerAdminEquipe } from "./actions";

export const metadata: Metadata = { title: "Équipe du cabinet" };

type Affectation = { entreprise_id: string; profil_id: string; role: string; actif: boolean; profils: unknown };

// Équipe du cabinet : les administrateurs (gestion du cabinet) et les collaborateurs, affectés
// avec une tâche à une ou plusieurs entreprises clientes, sans accès à la gestion du cabinet.
export default async function PageEquipe({ searchParams }: { searchParams: Promise<{ cabinet?: string }> }) {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const { cabinets } = await droitsUtilisateur();
  if (!cabinets.length) notFound();
  const demande = (await searchParams).cabinet;
  const cabinetId = cabinets.find((c) => c.cabinet_id === demande)?.cabinet_id ?? cabinets[0].cabinet_id;

  const [{ data: cabinet }, { data: admins }, { data: entreprises }] = await Promise.all([
    supabase.from("cabinets").select("id, nom").eq("id", cabinetId).maybeSingle(),
    supabase.from("membres_cabinet").select("profil_id, profils(nom_complet, email, active_le)").eq("cabinet_id", cabinetId),
    supabase.from("entreprises").select("id, raison_sociale, interne_cabinet").eq("cabinet_id", cabinetId).eq("statut", "active").order("raison_sociale"),
  ]);
  if (!cabinet) notFound();
  const listeEntreprises = [...(entreprises ?? [])].sort((a, b) => Number(b.interne_cabinet) - Number(a.interne_cabinet));
  const nomEntreprise = new Map(listeEntreprises.map((e) => [e.id, e.interne_cabinet ? `${e.raison_sociale} (Mon cabinet)` : e.raison_sociale]));

  const { data: affectations } = listeEntreprises.length
    ? await supabase
        .from("affectations")
        .select("entreprise_id, profil_id, role, actif, profils(nom_complet, email, active_le)")
        .in("entreprise_id", listeEntreprises.map((e) => e.id))
    : { data: [] as Affectation[] };

  // Regroupement par personne
  const parPersonne = new Map<string, { profils: unknown; acces: Affectation[] }>();
  for (const a of (affectations ?? []) as Affectation[]) {
    const personne = parPersonne.get(a.profil_id) ?? { profils: a.profils, acces: [] };
    personne.acces.push(a);
    parPersonne.set(a.profil_id, personne);
  }
  const collaborateurs = [...parPersonne.entries()].sort(([, a], [, b]) => champLie(a.profils, "nom_complet").localeCompare(champLie(b.profils, "nom_complet")));

  return (
    <Page>
      <EnTetePage
        titre="Équipe du cabinet"
        description={`${cabinet.nom} : qui gère le cabinet, et qui travaille sur quelles entreprises clientes.`}
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />

      {cabinets.length > 1 && (
        <nav aria-label="Choix du cabinet" className="flex flex-wrap gap-2">
          {cabinets.map((c) => (
            <Link key={c.cabinet_id} href={`/espace/equipe?cabinet=${c.cabinet_id}`} className={classesBouton(c.cabinet_id === cabinetId ? "principal" : "secondaire", "petit")}>
              {champLie(c.cabinets, "nom")}
            </Link>
          ))}
        </nav>
      )}

      <Carte titre="Affecter un collaborateur" description="Donnez une tâche à un employé du cabinet dans une ou plusieurs entreprises clientes. Il ne verra que ces entreprises et n'aura pas accès à la gestion du cabinet.">
        {!listeEntreprises.length ? (
          <p className="text-sm text-doux">Aucune entreprise cliente active pour l&apos;instant.</p>
        ) : (
          <Formulaire action={affecterMembreEquipe.bind(null, cabinetId)} libelleBouton="Affecter" colonnes={2}>
            <Champ nom="nom_complet" libelle="Nom complet" requis />
            <Champ nom="email" libelle="Email" type="email" requis aide="S'il a déjà un compte, l'accès est simplement ajouté." />
            <ChoixListe
              nom="role"
              libelle="Tâche"
              requis
              pleineLargeur
              options={ROLES_EQUIPE_CABINET.map((r) => ({ valeur: r, libelle: libelleRole(r) }))}
            />
            <TitreGroupe>Entreprises clientes concernées</TitreGroupe>
            {listeEntreprises.map((e) => (
              <CaseACocher key={e.id} nom={`entreprise:${e.id}`}>
                {nomEntreprise.get(e.id)}
              </CaseACocher>
            ))}
          </Formulaire>
        )}
      </Carte>

      <Carte titre={`Collaborateurs (${collaborateurs.length})`} description="Personnes affectées aux entreprises du cabinet, avec leurs tâches." sansMarge>
        {!collaborateurs.length ? (
          <EtatVide icone={Users} titre="Aucun collaborateur" texte="Affectez un premier collaborateur avec le formulaire ci-dessus." />
        ) : (
          <ul className="divide-y divide-bordure">
            {collaborateurs.map(([profilId, p]) => {
              const enAttente = valeurLiee(p.profils, "active_le") === null;
              return (
                <li key={profilId} className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{champLie(p.profils, "nom_complet")}</p>
                      <p className="text-sm text-doux">{champLie(p.profils, "email")}</p>
                    </div>
                    {enAttente && (
                      <div className="flex flex-col items-end gap-1">
                        <Badge teinte="ambre">Invitation en attente</Badge>
                        <ActionEnLigne action={renvoyerInvitationEntreprise.bind(null, p.acces[0].entreprise_id, profilId)} libelle="Renvoyer" variante="discret" />
                      </div>
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {p.acces.map((a) => (
                      <li key={`${a.entreprise_id}-${a.role}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/[.03] px-3 py-2 text-sm">
                        <span className={a.actif ? "" : "text-doux line-through"}>
                          {libelleRole(a.role)} · {nomEntreprise.get(a.entreprise_id)}
                        </span>
                        <form action={changerAcces.bind(null, a.entreprise_id, a.profil_id, a.role, !a.actif)}>
                          <button type="submit" className={classesBouton(a.actif ? "discret" : "secondaire", "petit")}>
                            {a.actif ? "Retirer" : "Rétablir"}
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      <Carte titre="Administrateurs du cabinet" description="Ils gèrent le cabinet, son équipe et toutes les entreprises clientes." sansMarge>
        {!admins?.length ? (
          <EtatVide icone={UserRound} titre="Aucun administrateur" />
        ) : (
          <ListeLignes>
            {admins.map((a) => {
              const enAttente = valeurLiee(a.profils, "active_le") === null;
              return (
                <Ligne
                  key={a.profil_id}
                  icone={ShieldCheck}
                  titre={`${champLie(a.profils, "nom_complet")}${a.profil_id === utilisateur.id ? " (vous)" : ""}`}
                  sousTitre={champLie(a.profils, "email")}
                  fin={
                    <div className="flex flex-col items-end gap-1">
                      {enAttente ? (
                        <>
                          <Badge teinte="ambre">Invitation en attente</Badge>
                          <ActionEnLigne action={renvoyerInvitationAdmin.bind(null, cabinetId, a.profil_id)} libelle="Renvoyer" variante="discret" />
                        </>
                      ) : (
                        <Badge teinte="vert">Administrateur du cabinet</Badge>
                      )}
                      {admins.length > 1 && <ActionEnLigne action={retirerAdminEquipe.bind(null, cabinetId, a.profil_id)} libelle="Retirer" variante="danger" />}
                    </div>
                  }
                />
              );
            })}
          </ListeLignes>
        )}
        <div className="border-t border-bordure p-4 sm:p-5">
          <p className="mb-3 font-semibold">Ajouter un administrateur du cabinet</p>
          <Formulaire action={ajouterAdminEquipe.bind(null, cabinetId)} libelleBouton="Envoyer l'invitation" colonnes={2}>
            <Champ nom="nom_complet" libelle="Nom complet" requis />
            <Champ nom="email" libelle="Email" type="email" requis />
          </Formulaire>
        </div>
      </Carte>
    </Page>
  );
}
