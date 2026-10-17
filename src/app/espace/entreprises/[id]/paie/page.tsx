import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarRange, Workflow } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { anneesProposees, libellePeriode, STATUTS_PERIODE, type EtapeCircuit, type StatutPeriode } from "@/lib/bulletins/regles";
import { Formulaire } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, LienBouton, Page } from "@/components/ui";
import { Pastilles, Tableau } from "@/components/tableau";
import { creerPeriode } from "./actions";
import { ChoixPeriode } from "./choix-periode";

export const metadata: Metadata = { title: "Paie et bulletins" };

export default async function PagePeriodes({ params, searchParams }: PageProps<"/espace/entreprises/[id]/paie">) {
  const { id } = await params;
  const { statut } = await searchParams;
  const filtre = typeof statut === "string" && statut in STATUTS_PERIODE ? (statut as StatutPeriode) : "tous";
  const { supabase } = await exigerUtilisateur();

  const [{ data: entreprise }, { data: periodes }, { data: peutDeposer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase
      .from("periodes_paie")
      .select("id, annee, mois, statut, circuit, etape_courante, bulletins(count)")
      .eq("entreprise_id", id)
      .order("annee", { ascending: false })
      .order("mois", { ascending: false }),
    supabase.rpc("peut_deposer_bulletins", { p_entreprise_id: id }),
  ]);
  if (!entreprise) notFound();

  const toutes = periodes ?? [];
  const visibles = filtre === "tous" ? toutes : toutes.filter((p) => p.statut === filtre);
  const lienFiltre = (s: string) => `/espace/entreprises/${id}/paie${s === "tous" ? "" : `?statut=${s}`}`;
  const existantes = (periodes ?? []).map((p) => `${p.annee}-${String(p.mois).padStart(2, "0")}`);
  // Par défaut : le mois en cours
  const aujourdhui = new Date();

  return (
    <Page>
      <EnTetePage
        titre="Paie et bulletins"
        description={entreprise.raison_sociale}
        fil={[
          { href: "/espace/entreprises", libelle: "Entreprises" },
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
        ]}
        actions={
          <LienBouton href={`/espace/entreprises/${id}/paie/circuit`} variante="secondaire" icone={Workflow}>
            Circuit de validation
          </LienBouton>
        }
      />

      <Carte titre="Périodes de paie" description="Une période par mois. Les bulletins se déposent tant que la période est en brouillon." sansMarge>
        {!toutes.length ? (
          <EtatVide
            icone={CalendarRange}
            titre="Aucune période"
            texte={peutDeposer === true ? "Créez la période du mois pour commencer à déposer les bulletins." : undefined}
            action={
              peutDeposer === true ? (
                <LienBouton href="#nouvelle-periode" icone={CalendarRange}>
                  Ouvrir une période
                </LienBouton>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <Pastilles
              libelle="Filtrer par statut"
              elements={[
                { href: lienFiltre("tous"), libelle: "Toutes", actif: filtre === "tous", nombre: toutes.length },
                ...(Object.keys(STATUTS_PERIODE) as StatutPeriode[]).map((s) => ({
                  href: lienFiltre(s),
                  libelle: STATUTS_PERIODE[s].libelle,
                  actif: filtre === s,
                  nombre: toutes.filter((p) => p.statut === s).length,
                })),
              ]}
            />
            {!visibles.length ? (
              <EtatVide
                icone={CalendarRange}
                titre="Aucune période avec ce statut"
                action={
                  <LienBouton href={lienFiltre("tous")} variante="secondaire">
                    Voir toutes les périodes
                  </LienBouton>
                }
              />
            ) : (
              <Tableau
                legende="Périodes de paie"
                lignes={visibles}
                cleLigne={(p) => p.id}
                hrefLigne={(p) => `/espace/entreprises/${id}/paie/${p.id}`}
                colonnes={[
                  { cle: "periode", titre: "Période", principale: true, rendu: (p) => libellePeriode(p.annee, p.mois) },
                  {
                    cle: "bulletins",
                    titre: "Bulletins déposés",
                    rendu: (p) => (p.bulletins as unknown as { count: number }[])[0]?.count ?? 0,
                  },
                  {
                    cle: "etape",
                    titre: "Étape du circuit",
                    rendu: (p) => {
                      const circuit = (p.circuit as EtapeCircuit[] | null) ?? [];
                      const etape = p.etape_courante ? circuit[p.etape_courante - 1] : undefined;
                      return etape ? `${p.etape_courante}/${circuit.length} : ${etape.libelle}` : null;
                    },
                  },
                  {
                    cle: "statut",
                    titre: "Statut",
                    statut: true,
                    rendu: (p) => {
                      const s = STATUTS_PERIODE[p.statut as StatutPeriode];
                      return <Badge teinte={s.teinte}>{s.libelle}</Badge>;
                    },
                  },
                ]}
              />
            )}
          </div>
        )}
      </Carte>

      {peutDeposer === true && (
        <div id="nouvelle-periode" className="scroll-mt-24">
          <Carte titre="Nouvelle période">
            <Formulaire action={creerPeriode.bind(null, id)} libelleBouton="Créer la période" colonnes={2}>
              <ChoixPeriode
                annees={anneesProposees(aujourdhui)}
                existantes={existantes}
                anneeInitiale={aujourdhui.getUTCFullYear()}
                moisInitial={aujourdhui.getUTCMonth() + 1}
              />
            </Formulaire>
          </Carte>
        </div>
      )}
    </Page>
  );
}
