import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarRange, Workflow } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { anneesProposees, libellePeriode, STATUTS_PERIODE, type EtapeCircuit, type StatutPeriode } from "@/lib/bulletins/regles";
import { Formulaire } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, LienBouton, Ligne, ListeLignes, Page } from "@/components/ui";
import { creerPeriode } from "./actions";
import { ChoixPeriode } from "./choix-periode";

export const metadata: Metadata = { title: "Paie et bulletins" };

export default async function PagePeriodes({ params }: PageProps<"/espace/entreprises/[id]/paie">) {
  const { id } = await params;
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
        {!periodes?.length ? (
          <EtatVide
            icone={CalendarRange}
            titre="Aucune période"
            texte={peutDeposer === true ? "Créez la période du mois pour commencer à déposer les bulletins." : undefined}
          />
        ) : (
          <ListeLignes>
            {periodes.map((p) => {
              const statut = STATUTS_PERIODE[p.statut as StatutPeriode];
              const nb = (p.bulletins as unknown as { count: number }[])[0]?.count ?? 0;
              const circuit = (p.circuit as EtapeCircuit[] | null) ?? [];
              const etape = p.etape_courante ? circuit[p.etape_courante - 1] : undefined;
              return (
                <Ligne
                  key={p.id}
                  href={`/espace/entreprises/${id}/paie/${p.id}`}
                  icone={CalendarRange}
                  titre={libellePeriode(p.annee, p.mois)}
                  sousTitre={`${nb} bulletin${nb > 1 ? "s" : ""} déposé${nb > 1 ? "s" : ""}${etape ? ` · étape ${p.etape_courante}/${circuit.length} : ${etape.libelle}` : ""}`}
                  fin={<Badge teinte={statut.teinte}>{statut.libelle}</Badge>}
                />
              );
            })}
          </ListeLignes>
        )}
      </Carte>

      {peutDeposer === true && (
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
      )}
    </Page>
  );
}
