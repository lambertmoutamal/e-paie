import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { entreprisesAccessibles } from "@/lib/entreprise-courante";
import { ListeChoixEntreprises } from "./liste";

export const metadata: Metadata = { title: "Choisir l'entreprise" };

// Écran affiché après la connexion à ceux qui ont accès à plusieurs entreprises.
export default async function PageChoisirEntreprise() {
  const { supabase } = await exigerUtilisateur();
  const liste = await entreprisesAccessibles();
  if (liste.length <= 1) redirect("/espace");

  // Nombre de salariés en poste par entreprise (la base limite aux entreprises accessibles)
  const { data: salaries } = await supabase.from("salaries").select("entreprise_id").eq("statut", "actif").limit(10000);
  const effectifs = new Map<string, number>();
  for (const s of salaries ?? []) effectifs.set(s.entreprise_id, (effectifs.get(s.entreprise_id) ?? 0) + 1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sur quelle entreprise voulez-vous travailler ?</h1>
        <p className="mt-1 text-doux">Vous pourrez en changer à tout moment depuis la barre du haut.</p>
      </header>
      <ListeChoixEntreprises entreprises={liste.map((e) => ({ ...e, effectif: effectifs.get(e.id) ?? 0 }))} />
    </div>
  );
}
