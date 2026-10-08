import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, UserRound, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie, valeurLiee } from "@/lib/supabase/relations";
import { ROLES_ENTREPRISE } from "@/lib/validation/schemas";
import { ActionEnLigne, Champ, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, classesBouton, EnTetePage, EtatVide, LienBouton, Ligne, ListeLignes, Page } from "@/components/ui";
import { ajouterUtilisateur, changerAcces, modifierEntreprise, renvoyerInvitationEntreprise } from "../actions";
import { ChampsEntreprise } from "../champs-entreprise";

export const metadata: Metadata = { title: "Entreprise" };

export default async function PageEntreprise({ params }: PageProps<"/espace/entreprises/[id]">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();

  // La RLS ne renvoie l'entreprise qu'aux personnes qui y ont accès.
  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("id, raison_sociale, nif, rccm, numero_cnss, adresse, telephone, email, mode, statut, cabinet_id, cabinets(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!entreprise) notFound();

  const [{ data: gere }, { data: affectations }, { count: nbSalaries }] = await Promise.all([
    supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: id }),
    supabase
      .from("affectations")
      .select("profil_id, role, actif, profils(nom_complet, email, active_le)")
      .eq("entreprise_id", id)
      .order("actif", { ascending: false }),
    supabase.from("salaries").select("id", { count: "exact", head: true }).eq("entreprise_id", id).eq("statut", "actif"),
  ]);
  const peutGerer = gere === true;
  const nomCabinet = entreprise.cabinets ? champLie(entreprise.cabinets, "nom") : null;

  return (
    <Page>
      <EnTetePage
        titre={entreprise.raison_sociale}
        description={nomCabinet ? `Cliente du cabinet ${nomCabinet}` : "Sans cabinet"}
        fil={[
          { href: "/espace", libelle: "Tableau de bord" },
          { href: "/espace/entreprises", libelle: "Entreprises" },
        ]}
        actions={
          <>
            <Badge teinte={entreprise.mode === "autonome" ? "bleu" : "vert"}>
              {entreprise.mode === "autonome" ? "Mode autonome" : "Mode cabinet"}
            </Badge>
            <LienBouton href={`/espace/entreprises/${id}/salaries`} icone={Users}>
              Salariés ({nbSalaries ?? 0})
            </LienBouton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Carte titre="Utilisateurs et rôles" description="Les personnes qui interviennent sur cette entreprise." sansMarge>
            {!affectations?.length ? (
              <EtatVide icone={Users} titre="Personne n'est encore affecté" texte="Invitez le gestionnaire de paie, le contrôleur, le signataire et le responsable RH." />
            ) : (
              <ListeLignes>
                {affectations.map((a) => {
                  const enAttente = valeurLiee(a.profils, "active_le") === null;
                  return (
                    <Ligne
                      key={`${a.profil_id}-${a.role}`}
                      icone={UserRound}
                      titre={<span className={a.actif ? "" : "text-doux line-through"}>{champLie(a.profils, "nom_complet")}</span>}
                      sousTitre={
                        <span className="flex flex-wrap items-center gap-1.5">
                          {libelleRole(a.role)}
                          {!a.actif ? <Badge teinte="rouge">Accès retiré</Badge> : enAttente ? <Badge teinte="ambre">Invitation en attente</Badge> : null}
                        </span>
                      }
                      fin={
                        peutGerer && (
                          <div className="flex flex-col items-end gap-1">
                            {a.actif && enAttente && (
                              <ActionEnLigne action={renvoyerInvitationEntreprise.bind(null, id, a.profil_id)} libelle="Renvoyer l'invitation" variante="discret" />
                            )}
                            <form action={changerAcces.bind(null, id, a.profil_id, a.role, !a.actif)}>
                              <button type="submit" className={classesBouton(a.actif ? "danger" : "secondaire", "petit")}>
                                {a.actif ? "Retirer" : "Rétablir"}
                              </button>
                            </form>
                          </div>
                        )
                      }
                    />
                  );
                })}
              </ListeLignes>
            )}
          </Carte>

          {peutGerer && (
            <Carte titre={`Inviter une personne à ${entreprise.raison_sociale}`} description="Elle recevra un email pour activer son compte et choisir son mot de passe.">
              <Formulaire action={ajouterUtilisateur.bind(null, id)} libelleBouton="Envoyer l'invitation" colonnes={2}>
                <Champ nom="nom_complet" libelle="Nom complet de la personne" requis />
                <Champ nom="email" libelle="Email de la personne" type="email" requis />
                <ChoixListe
                  nom="role"
                  libelle="Rôle"
                  requis
                  pleineLargeur
                  options={ROLES_ENTREPRISE.map((r) => ({ valeur: r, libelle: libelleRole(r) }))}
                  aide="Si la personne a déjà un compte (autre entreprise), l'accès est simplement ajouté."
                />
              </Formulaire>
            </Carte>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Carte titre="Fiche entreprise">
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {[
                ["NIF", entreprise.nif],
                ["RCCM", entreprise.rccm],
                ["N° employeur CNSS", entreprise.numero_cnss],
                ["Téléphone", entreprise.telephone],
                ["Email de l'entreprise", entreprise.email],
                ["Adresse", entreprise.adresse],
              ].map(([libelle, valeur]) => (
                <div key={libelle} className="flex justify-between gap-4 border-b border-bordure pb-2 last:border-0 last:pb-0">
                  <dt className="text-doux">{libelle}</dt>
                  <dd className="text-right font-medium">{valeur || "—"}</dd>
                </div>
              ))}
            </dl>
            {peutGerer && (
              // Formulaire replié par défaut : il ne se confond pas avec l'invitation d'une personne.
              <details className="group mt-4 border-t border-bordure pt-4">
                <summary className={`${classesBouton("secondaire", "petit")} cursor-pointer list-none`}>
                  <Pencil size={14} aria-hidden />
                  Modifier la fiche
                </summary>
                <div className="mt-4">
                  <Formulaire action={modifierEntreprise.bind(null, id)} libelleBouton="Enregistrer la fiche">
                    <ChampsEntreprise fiche={entreprise} />
                  </Formulaire>
                </div>
              </details>
            )}
          </Carte>
          <p className="text-xs text-doux">
            Logo, cachet et signature numérisés : ajout prévu avec le dépôt des fichiers (étape 7).
          </p>
        </div>
      </div>
    </Page>
  );
}
