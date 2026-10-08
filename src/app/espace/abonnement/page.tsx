import type { Metadata } from "next";
import { CreditCard, Receipt, Tag } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate, libellePhase, type Phase } from "@/lib/abonnements/phases";
import { LIBELLES_STATUT, montantAPayer, type StatutPaiement } from "@/lib/paiement/regles";
import { ActionEnLigne, Champ, ChoixCartes, ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, Page } from "@/components/ui";
import { activerAbonnement, demanderPassagePro, modifierFormule, payerAbonnement, verifierPaiement } from "./actions";
import { SuiviPaiement } from "./suivi-paiement";

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

type Formule = {
  id: string;
  code: string;
  libelle: string;
  est_essai: boolean;
  prix_mensuel: number;
  devise: string;
  description: string | null;
};

type Paiement = {
  id: string;
  abonnement_id: string;
  montant: number;
  devise: string;
  duree_mois: number;
  statut: StatutPaiement;
  cree_le: string;
  periode_fin: string | null;
};

const NOMBRE = new Intl.NumberFormat("fr-FR");
const prix = (montant: number, devise: string) => `${NOMBRE.format(montant)} ${devise === "XAF" || devise === "XOF" ? "FCFA" : devise}`;

export default async function PageAbonnement({ searchParams }: PageProps<"/espace/abonnement">) {
  const { paiement: paiementSuivi } = await searchParams;
  const { supabase } = await exigerUtilisateur();
  const { adminPlateforme } = await droitsUtilisateur();
  const [{ data }, { data: formulesBrutes }, { data: paiementsBruts }] = await Promise.all([
    supabase.rpc("mes_abonnements"),
    supabase
      .from("formules")
      .select("id, code, libelle, est_essai, prix_mensuel, devise, description")
      .order("est_essai", { ascending: false }),
    supabase
      .from("paiements")
      .select("id, abonnement_id, montant, devise, duree_mois, statut, cree_le, periode_fin")
      .order("cree_le", { ascending: false })
      .limit(50),
  ]);
  const abonnements = (data ?? []) as Abonnement[];
  const formules = (formulesBrutes ?? []) as Formule[];
  const paiements = (paiementsBruts ?? []) as Paiement[];
  const demandesPro = abonnements.filter((a) => a.demande_pro_le && a.phase !== "actif");
  const suivi = typeof paiementSuivi === "string" ? paiements.find((p) => p.id === paiementSuivi) : undefined;

  return (
    <Page>
      <EnTetePage
        titre={adminPlateforme ? "Abonnements" : "Mon abonnement"}
        description={adminPlateforme ? "Tous les abonnements de la plateforme." : "Votre formule, son échéance et vos paiements."}
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />

      {suivi && <SuiviPaiement paiementId={suivi.id} statutInitial={suivi.statut} verifier={verifierPaiement} />}

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
              const formulePro = formules.find((f) => f.code === (a.cabinet_id ? "pro_cabinet" : "pro_entreprise"));
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

                  {!adminPlateforme && <DetailClient a={a} formulePro={formulePro} />}

                  {adminPlateforme && (
                    <details className="rounded-lg border border-bordure p-3">
                      <summary className="cursor-pointer text-sm font-medium text-marque">Activer ou prolonger à la main</summary>
                      <div className="mt-3">
                        <Formulaire action={activerAbonnement.bind(null, a.abonnement_id)} libelleBouton="Enregistrer" colonnes={2}>
                          <ChoixListe
                            nom="formule_id"
                            libelle="Formule"
                            requis
                            valeurInitiale={a.formule_id}
                            options={formules.map((f) => ({ valeur: f.id, libelle: f.libelle }))}
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

      <Carte titre="Historique des paiements" sansMarge>
        {!paiements.length ? (
          <EtatVide icone={Receipt} titre="Aucun paiement" />
        ) : (
          <ul className="divide-y divide-bordure">
            {paiements.map((p) => {
              const { libelle, teinte } = LIBELLES_STATUT[p.statut];
              const titulaire = abonnements.find((a) => a.abonnement_id === p.abonnement_id)?.titulaire;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
                  <div>
                    <p className="font-medium">
                      {prix(Number(p.montant), p.devise)} · {p.duree_mois === 12 ? "12 mois" : "1 mois"}
                      {adminPlateforme && titulaire ? ` · ${titulaire}` : ""}
                    </p>
                    <p className="text-doux">
                      {formaterDate(p.cree_le)}
                      {p.statut === "reussi" && p.periode_fin ? ` · abonnement jusqu'au ${formaterDate(p.periode_fin)}` : ""}
                    </p>
                  </div>
                  <Badge teinte={teinte}>{libelle}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {adminPlateforme && (
        <Carte titre="Formules" description="Prix mensuels payés par Mobile Money. L'annuel coûte 10 mois (2 mois offerts)." sansMarge>
          <ul className="divide-y divide-bordure">
            {formules.map((f) => (
              <li key={f.id} className="px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-center gap-2">
                  <Tag size={16} className="text-marque" aria-hidden />
                  <p className="font-semibold">{f.libelle}</p>
                  <Badge>{f.est_essai ? "Essai" : `${prix(Number(f.prix_mensuel), f.devise)} / mois`}</Badge>
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

function DetailClient({ a, formulePro }: { a: Abonnement; formulePro?: Formule }) {
  const texte =
    a.phase === "essai"
      ? `Il vous reste ${a.jours_restants} jour(s) d'essai gratuit.`
      : a.phase === "actif"
        ? `Abonnement actif jusqu'au ${formaterDate(a.fin)}.`
        : a.phase === "lecture_seule"
          ? `Votre abonnement est terminé : consultation seule jusqu'au ${formaterDate(a.fin_lecture_seule)}, puis blocage de l'accès pour tous, salariés compris.`
          : "L'accès est bloqué pour tous les utilisateurs. Payez votre abonnement pour le rétablir.";

  const mensuel = formulePro ? Number(formulePro.prix_mensuel) : 0;
  const paiementPossible = mensuel > 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-black/[.02] p-4 text-sm">
      <p>{texte}</p>

      {paiementPossible && formulePro ? (
        <div className="rounded-lg border border-bordure bg-surface p-4">
          <p className="mb-1 font-semibold">{a.phase === "actif" ? "Prolonger" : "Souscrire"} : {formulePro.libelle}</p>
          <p className="mb-4 text-doux">Paiement sécurisé par Mobile Money (Airtel Money, Moov Money…).</p>
          <Formulaire action={payerAbonnement.bind(null, a.abonnement_id)} libelleBouton="Payer avec Mobile Money">
            <ChoixCartes
              nom="duree"
              libelle="Durée"
              valeurInitiale="12"
              options={[
                { valeur: "1", titre: `1 mois : ${prix(montantAPayer(mensuel, 1), formulePro.devise)}`, texte: "Sans engagement." },
                {
                  valeur: "12",
                  titre: `12 mois : ${prix(montantAPayer(mensuel, 12), formulePro.devise)}`,
                  texte: `2 mois offerts (au lieu de ${prix(mensuel * 12, formulePro.devise)}).`,
                },
              ]}
            />
            <Champ
              nom="telephone"
              libelle="Numéro Mobile Money"
              type="tel"
              requis
              autoComplete="tel"
              aide="Au format international, par exemple +241 77 12 34 56. Vous validerez le paiement sur ce téléphone."
            />
          </Formulaire>
        </div>
      ) : (
        a.phase !== "actif" &&
        (a.demande_pro_le ? (
          <p className="text-doux">Demande Pro envoyée le {formaterDate(a.demande_pro_le)} : nous vous contactons.</p>
        ) : (
          <div className="flex justify-end">
            <ActionEnLigne action={demanderPassagePro.bind(null, a.abonnement_id, a.titulaire)} libelle="Passer à Pro" />
          </div>
        ))
      )}
    </div>
  );
}
