import type { Metadata } from "next";
import { CreditCard, Tag } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate, libellePhase, type Phase } from "@/lib/abonnements/phases";
import { ActionEnLigne, Champ, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, Page } from "@/components/ui";
import { activerAbonnement, demanderPassagePro, modifierFormule } from "./actions";

export const metadata: Metadata = { title: "Abonnement" };

type Abonnement = {
  abonnement_id: string;
  titulaire: string;
  cabinet_id: string | null;
  formule_id: string;
  formule: string;
  phase: Phase;
  debut: string;
  fin: string;
  jours_restants: number;
  fin_lecture_seule: string;
  demande_pro_le: string | null;
};

const PRIX = new Intl.NumberFormat("fr-FR");

export default async function PageAbonnement() {
  const { supabase } = await exigerUtilisateur();
  const { adminPlateforme } = await droitsUtilisateur();
  const [{ data }, { data: formules }] = await Promise.all([
    supabase.rpc("mes_abonnements"),
    supabase.from("formules").select("id, code, libelle, cible, est_essai, prix_mensuel, devise, description, actif").order("est_essai", { ascending: false }),
  ]);
  const abonnements = (data ?? []) as Abonnement[];
  const demandesPro = abonnements.filter((a) => a.demande_pro_le && a.phase !== "actif");

  return (
    <Page>
      <EnTetePage
        titre={adminPlateforme ? "Abonnements" : "Mon abonnement"}
        description={adminPlateforme ? "Tous les abonnements de la plateforme." : "Votre formule et sa date d'échéance."}
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />

      {adminPlateforme && demandesPro.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{demandesPro.length} demande(s) de passage à Pro</strong> en attente : {demandesPro.map((a) => a.titulaire).join(", ")}.
        </p>
      )}

      <Carte titre={adminPlateforme ? `${abonnements.length} abonnement(s)` : "Abonnement"} sansMarge>
        {!abonnements.length ? (
          <EtatVide
            icone={CreditCard}
            titre="Aucun abonnement"
            texte={adminPlateforme ? "Les inscriptions libres apparaîtront ici." : "Votre espace est géré directement par la plateforme."}
          />
        ) : (
          <ul className="divide-y divide-bordure">
            {abonnements.map((a) => {
              const { libelle, teinte } = libellePhase(a.phase);
              return (
                <li key={a.abonnement_id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.titulaire}</p>
                      <p className="text-sm text-doux">
                        {a.cabinet_id ? "Cabinet" : "Entreprise"} · {a.formule} · du {formaterDate(a.debut)} au {formaterDate(a.fin)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {a.demande_pro_le && a.phase !== "actif" && <Badge teinte="ambre">Pro demandé</Badge>}
                      <Badge teinte={teinte}>{libelle}</Badge>
                    </div>
                  </div>

                  {!adminPlateforme && <DetailClient a={a} />}

                  {adminPlateforme && (
                    <details className="rounded-lg border border-bordure p-3">
                      <summary className="cursor-pointer text-sm font-medium text-marque">Activer ou prolonger</summary>
                      <div className="mt-3">
                        <Formulaire action={activerAbonnement.bind(null, a.abonnement_id)} libelleBouton="Enregistrer" colonnes={2}>
                          <ChoixListe
                            nom="formule_id"
                            libelle="Formule"
                            requis
                            valeurInitiale={a.formule_id}
                            options={(formules ?? []).map((f) => ({ valeur: f.id, libelle: f.libelle }))}
                          />
                          <Champ nom="fin" libelle="Date de fin (AAAA-MM-JJ)" requis valeurInitiale={a.fin.slice(0, 10)} aide="Exemple : 2026-12-31" />
                        </Formulaire>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {adminPlateforme && (
        <Carte titre="Formules" description="Prix mensuels affichés aux prospects. Mettez 0 tant que les tarifs ne sont pas fixés." sansMarge>
          <ul className="divide-y divide-bordure">
            {(formules ?? []).map((f) => (
              <li key={f.id} className="px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-center gap-2">
                  <Tag size={16} className="text-marque" aria-hidden />
                  <p className="font-semibold">{f.libelle}</p>
                  <Badge>{f.est_essai ? "Essai" : `${PRIX.format(Number(f.prix_mensuel))} ${f.devise} / mois`}</Badge>
                </div>
                <Formulaire action={modifierFormule.bind(null, f.id)} libelleBouton="Enregistrer" colonnes={2}>
                  <Champ nom="libelle" libelle="Nom" requis valeurInitiale={f.libelle} />
                  <Champ nom="prix_mensuel" libelle={`Prix mensuel (${f.devise})`} requis valeurInitiale={String(f.prix_mensuel)} />
                  <Champ nom="description" libelle="Description" pleineLargeur valeurInitiale={f.description} />
                </Formulaire>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </Page>
  );
}

function DetailClient({ a }: { a: Abonnement }) {
  const texte =
    a.phase === "essai"
      ? `Il vous reste ${a.jours_restants} jour(s) d'essai gratuit.`
      : a.phase === "actif"
        ? `Abonnement actif jusqu'au ${formaterDate(a.fin)}.`
        : a.phase === "lecture_seule"
          ? `Votre abonnement est terminé : consultation seule jusqu'au ${formaterDate(a.fin_lecture_seule)}, puis blocage de l'accès pour tous, salariés compris.`
          : "L'accès est bloqué pour tous les utilisateurs. Souscrivez un abonnement pour le rétablir.";

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-black/[.02] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>{texte}</p>
      {a.phase !== "actif" &&
        (a.demande_pro_le ? (
          <p className="text-doux">Demande Pro envoyée le {formaterDate(a.demande_pro_le)} : nous vous contactons.</p>
        ) : (
          <ActionEnLigne
            action={demanderPassagePro.bind(null, a.abonnement_id, a.titulaire)}
            libelle="Passer à Pro"
            variante="secondaire"
          />
        ))}
    </div>
  );
}
