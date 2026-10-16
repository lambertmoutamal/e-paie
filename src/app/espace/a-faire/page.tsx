import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Building2, Sparkles } from "lucide-react";
import { mesDemandesEntreprises, mesTachesEntrepriseCourante } from "@/lib/bulletins/actions-a-faire";
import { exigerEntrepriseCourante } from "@/lib/entreprise-courante";
import { CarteActionsPaie } from "@/components/actions-paie";
import { Carte, Page } from "@/components/ui";

export const metadata: Metadata = { title: "À faire" };

// Ce qui attend la personne dans l'entreprise de travail (validations de paie, demandes
// d'absence, réclamations), et un décompte pour ses autres entreprises.
export default async function PageAFaire() {
  const courante = await exigerEntrepriseCourante();
  const [{ actions, demandes, reclamations, nombre: total, ailleurs }, demandesEntreprises] = await Promise.all([mesTachesEntrepriseCourante(), mesDemandesEntreprises()]);
  return (
    <Page>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">À faire</h1>
        <p className="text-doux">{courante.raison_sociale}</p>
      </header>
      {demandesEntreprises > 0 && (
        <Link
          href="/espace/demandes-entreprises"
          className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-claire px-5 py-4 font-semibold text-foreground transition hover:shadow-md"
        >
          <Building2 size={20} className="text-accent" aria-hidden />
          {demandesEntreprises} entreprise{demandesEntreprises > 1 ? "s souhaitent" : " souhaite"} confier sa paie à votre cabinet
        </Link>
      )}
      {total ? (
        <CarteActionsPaie actions={actions} demandes={demandes} reclamations={reclamations} />
      ) : (
        <section className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
          <span className="grid size-11 place-items-center rounded-full bg-emerald-500 text-white">
            <Sparkles size={20} aria-hidden />
          </span>
          <div>
            <p className="font-semibold">Rien à faire pour l&apos;instant</p>
            <p className="text-sm text-emerald-800/80">Les validations, demandes et réclamations qui vous attendent apparaîtront ici.</p>
          </div>
        </section>
      )}
      {ailleurs.length > 0 && (
        <Carte titre="Dans vos autres entreprises" description="Pour les traiter, passez sur l'entreprise concernée.">
          <ul className="flex flex-col gap-2">
            {ailleurs.map((e) => (
              <li key={e.entreprise_id}>
                <Link href={`/espace/entreprises/${e.entreprise_id}`} className="inline-flex items-center gap-2 text-sm font-medium text-marque hover:underline">
                  <ArrowLeftRight size={15} aria-hidden />
                  {e.raison_sociale} : {e.nombre} action{e.nombre > 1 ? "s" : ""} à faire
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </Page>
  );
}
