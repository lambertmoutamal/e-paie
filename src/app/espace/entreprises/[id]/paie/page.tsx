import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libellePeriode, moisProposes, STATUTS_PERIODE, type StatutPeriode } from "@/lib/bulletins/regles";
import { ChoixListe, Formulaire } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, Ligne, ListeLignes, Page } from "@/components/ui";
import { creerPeriode } from "./actions";

export const metadata: Metadata = { title: "Paie et bulletins" };

export default async function PagePeriodes({ params }: PageProps<"/espace/entreprises/[id]/paie">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();

  const [{ data: entreprise }, { data: periodes }, { data: peutDeposer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase
      .from("periodes_paie")
      .select("id, annee, mois, statut, bulletins(count)")
      .eq("entreprise_id", id)
      .order("annee", { ascending: false })
      .order("mois", { ascending: false }),
    supabase.rpc("peut_deposer_bulletins", { p_entreprise_id: id }),
  ]);
  if (!entreprise) notFound();

  const existantes = new Set((periodes ?? []).map((p) => `${p.annee}-${String(p.mois).padStart(2, "0")}`));
  const proposes = moisProposes();
  const disponibles = proposes.filter((m) => !existantes.has(m.valeur));
  // Par défaut : le mois en cours (troisième de la liste), sinon le premier mois libre.
  const parDefaut = disponibles.find((m) => m.valeur === proposes[2].valeur) ?? disponibles[0];

  return (
    <Page>
      <EnTetePage
        titre="Paie et bulletins"
        description={entreprise.raison_sociale}
        fil={[
          { href: "/espace/entreprises", libelle: "Entreprises" },
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
        ]}
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
              return (
                <Ligne
                  key={p.id}
                  href={`/espace/entreprises/${id}/paie/${p.id}`}
                  icone={CalendarRange}
                  titre={libellePeriode(p.annee, p.mois)}
                  sousTitre={`${nb} bulletin${nb > 1 ? "s" : ""} déposé${nb > 1 ? "s" : ""}`}
                  fin={<Badge teinte={statut.teinte}>{statut.libelle}</Badge>}
                />
              );
            })}
          </ListeLignes>
        )}
      </Carte>

      {peutDeposer === true && disponibles.length > 0 && (
        <Carte titre="Nouvelle période">
          <Formulaire action={creerPeriode.bind(null, id)} libelleBouton="Créer la période" colonnes={2}>
            <ChoixListe nom="periode" libelle="Mois de paie" requis options={disponibles} valeurInitiale={parDefaut.valeur} />
          </Formulaire>
        </Carte>
      )}
    </Page>
  );
}
