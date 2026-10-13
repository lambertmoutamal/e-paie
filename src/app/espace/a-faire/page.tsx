import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { mesActionsPaie, mesDemandesATraiter, mesReclamationsATraiter } from "@/lib/bulletins/actions-a-faire";
import { CarteActionsPaie } from "@/components/actions-paie";
import { Page } from "@/components/ui";

export const metadata: Metadata = { title: "À faire" };

// Tout ce qui attend la personne connectée : validations de paie, demandes d'absence, réclamations.
export default async function PageAFaire() {
  const [actions, demandes, reclamations] = await Promise.all([mesActionsPaie(), mesDemandesATraiter(), mesReclamationsATraiter()]);
  const total = actions.length + demandes.length + reclamations.length;
  return (
    <Page>
      <h1 className="text-2xl font-bold tracking-tight">À faire</h1>
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
    </Page>
  );
}
