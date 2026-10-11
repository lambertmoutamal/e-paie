import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole, type EtapeCircuit } from "@/lib/bulletins/regles";
import { Carte, EnTetePage, Page } from "@/components/ui";
import { definirCircuit } from "../actions";
import { EditeurCircuit } from "./editeur-circuit";

export const metadata: Metadata = { title: "Circuit de validation" };

export default async function PageCircuit({ params }: PageProps<"/espace/entreprises/[id]/paie/circuit">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();

  const [{ data: entreprise }, { data: circuit }, { data: peutGerer }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.rpc("circuit_entreprise", { p_entreprise_id: id }),
    supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: id }),
  ]);
  if (!entreprise || !circuit) notFound();
  const etapes = circuit as EtapeCircuit[];

  return (
    <Page>
      <EnTetePage
        titre="Circuit de validation"
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/paie`, libelle: "Paie et bulletins" },
        ]}
      />

      <p className="flex items-start gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-doux">
        <Info size={16} className="mt-0.5 shrink-0 text-marque" aria-hidden />
        <span>
          Une fois les bulletins déposés, la période passe par ces étapes, dans l&apos;ordre. La personne qui envoie la période, celles qui ont
          déposé des bulletins et celles qui ont déjà validé une étape ne peuvent pas valider. Un refus, toujours commenté, renvoie la période à
          l&apos;étape précédente. Après la dernière étape, la période est approuvée et verrouillée.
        </span>
      </p>

      <Carte titre={peutGerer === true ? "Étapes (1 à 5)" : "Étapes"}>
        {peutGerer === true ? (
          <EditeurCircuit action={definirCircuit.bind(null, id)} initial={etapes} />
        ) : (
          <ol className="flex flex-col gap-2">
            {etapes.map((e, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-marque-claire text-sm font-bold text-marque">{i + 1}</span>
                <span className="font-medium">{e.libelle}</span>
                <span className="text-sm text-doux">· {libelleRole(e.role)}</span>
              </li>
            ))}
          </ol>
        )}
      </Carte>
    </Page>
  );
}
