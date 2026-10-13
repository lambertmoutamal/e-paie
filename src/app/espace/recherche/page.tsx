import type { Metadata } from "next";
import { Search, UserRound } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { exigerEntrepriseCourante } from "@/lib/entreprise-courante";
import { champLie } from "@/lib/supabase/relations";
import { Avatar } from "@/components/avatar";
import { Badge, Carte, EtatVide, Ligne, ListeLignes, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Recherche" };

// Recherche d'un salarié dans l'entreprise de travail.
export default async function PageRecherche({ searchParams }: PageProps<"/espace/recherche">) {
  const { q } = await searchParams;
  const recherche = typeof q === "string" ? q.trim().slice(0, 60) : "";
  const { supabase } = await exigerUtilisateur();
  const courante = await exigerEntrepriseCourante();

  let resultats: { id: string; entreprise_id: string; matricule: string; nom: string; prenoms: string; poste: string | null; statut: string; entreprises: unknown }[] = [];
  if (recherche.length >= 2) {
    const motif = `%${recherche.replace(/[%_,()\\]/g, " ")}%`;
    const { data } = await supabase
      .from("salaries")
      .select("id, entreprise_id, matricule, nom, prenoms, poste, statut, entreprises(raison_sociale)")
      .eq("entreprise_id", courante.id)
      .or(`nom.ilike.${motif},prenoms.ilike.${motif},matricule.ilike.${motif}`)
      .order("nom")
      .limit(50);
    resultats = data ?? [];
  }

  return (
    <Page>
      <h1 className="text-2xl font-bold tracking-tight">Rechercher un salarié</h1>
      <form role="search" className="relative">
        <label htmlFor="q" className="sr-only">
          Nom, prénom ou matricule
        </label>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-doux" aria-hidden />
        <input
          id="q"
          name="q"
          defaultValue={recherche}
          autoFocus
          placeholder="Nom, prénom ou matricule…"
          className="h-12 w-full rounded-full border border-bordure bg-surface pl-11 pr-4 text-base shadow-sm outline-none focus:border-marque focus:ring-2 focus:ring-marque/20"
        />
      </form>

      {recherche.length >= 2 && (
        <Carte titre={`${resultats.length} résultat${resultats.length > 1 ? "s" : ""}`} sansMarge>
          {!resultats.length ? (
            <EtatVide icone={UserRound} titre="Aucun salarié trouvé" texte="Vérifiez l'orthographe ou essayez le matricule." />
          ) : (
            <ListeLignes>
              {resultats.map((s) => (
                <Ligne
                  key={s.id}
                  href={`/espace/entreprises/${s.entreprise_id}/salaries/${s.id}`}
                  titre={
                    <span className="flex items-center gap-3">
                      <Avatar nom={`${s.prenoms} ${s.nom}`} taille="petit" />
                      <span>
                        {s.nom} {s.prenoms}
                      </span>
                    </span>
                  }
                  sousTitre={`${s.poste ?? "Poste non renseigné"} · ${champLie(s.entreprises, "raison_sociale")} · matricule ${s.matricule}`}
                  fin={s.statut === "sorti" ? <Badge>Sorti(e)</Badge> : undefined}
                />
              ))}
            </ListeLignes>
          )}
        </Carte>
      )}
    </Page>
  );
}
