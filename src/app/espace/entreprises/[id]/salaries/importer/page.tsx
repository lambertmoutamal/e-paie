import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { Carte, EnTetePage, Page } from "@/components/ui";
import { ImportSalaries } from "./import-salaries";

export const metadata: Metadata = { title: "Importer des salariés" };

export default async function PageImport({ params }: PageProps<"/espace/entreprises/[id]/salaries/importer">) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();
  const [{ data: entreprise }, { data: peutGerer }, { data: historique }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
    supabase
      .from("imports_salaries")
      .select("id, nom_fichier, nb_crees, nb_mis_a_jour, cree_le, profils(nom_complet)")
      .eq("entreprise_id", id)
      .order("cree_le", { ascending: false })
      .limit(10),
  ]);
  if (!entreprise || peutGerer !== true) notFound();

  return (
    <Page>
      <EnTetePage
        titre="Importer des salariés"
        description={`Depuis un fichier Excel, pour ${entreprise.raison_sociale}.`}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/salaries`, libelle: "Salariés" },
        ]}
      />
      <ImportSalaries entrepriseId={id} />

      {!!historique?.length && (
        <Carte titre="Derniers imports">
          <ul className="flex flex-col gap-2 text-sm">
            {historique.map((h) => (
              <li key={h.id}>
                {formaterDate(h.cree_le)} · <strong>{h.nom_fichier}</strong> · {h.nb_crees} créé(s), {h.nb_mis_a_jour} mis à jour
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </Page>
  );
}
