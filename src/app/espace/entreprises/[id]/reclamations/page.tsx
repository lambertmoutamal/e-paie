import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { champLie } from "@/lib/supabase/relations";
import { STATUTS_RECLAMATION, SUJETS_RECLAMATION, type StatutReclamation, type SujetReclamation } from "@/lib/reclamations/regles";
import { Badge, Carte, EnTetePage, EtatVide, Ligne, ListeLignes, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Réclamations" };

const FILTRES = [
  { valeur: "actives", libelle: "À traiter et en cours" },
  { valeur: "resolue", libelle: "Résolues" },
  { valeur: "fermee", libelle: "Closes" },
  { valeur: "toutes", libelle: "Toutes" },
] as const;

export default async function PageReclamations({ params, searchParams }: PageProps<"/espace/entreprises/[id]/reclamations">) {
  const { id } = await params;
  const { statut: brut, sujet: sujetBrut } = await searchParams;
  const filtre = FILTRES.some((f) => f.valeur === brut) ? (brut as (typeof FILTRES)[number]["valeur"]) : "actives";
  const sujet = typeof sujetBrut === "string" && sujetBrut in SUJETS_RECLAMATION ? (sujetBrut as SujetReclamation) : null;
  const { supabase } = await exigerUtilisateur();

  // La base ne renvoie que les réclamations des sujets dont la personne est chargée (ou toutes pour un administrateur)
  let requete = supabase
    .from("reclamations")
    .select("id, sujet, objet, statut, derniere_activite, attente_personnel, salaries(nom, prenoms, matricule)")
    .eq("entreprise_id", id)
    .order("derniere_activite", { ascending: false })
    .limit(200);
  if (filtre === "actives") requete = requete.in("statut", ["ouverte", "en_cours"]);
  if (filtre === "resolue" || filtre === "fermee") requete = requete.eq("statut", filtre);
  if (sujet) requete = requete.eq("sujet", sujet);
  const [{ data: entreprise }, { data: reclamations }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    requete,
  ]);
  if (!entreprise) notFound();
  const lien = (changements: Record<string, string | null>) => {
    const p = new URLSearchParams({ statut: filtre, ...(sujet && { sujet }) });
    for (const [k, v] of Object.entries(changements)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `?${p}`;
  };

  return (
    <Page>
      <EnTetePage
        titre="Réclamations"
        description={entreprise.raison_sociale}
        fil={[
          { href: "/espace/entreprises", libelle: "Entreprises" },
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
        ]}
      />

      <div className="flex flex-col gap-2">
        <nav aria-label="Statut" className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <Link
              key={f.valeur}
              href={lien({ statut: f.valeur })}
              aria-current={f.valeur === filtre ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${f.valeur === filtre ? "border-marque bg-marque-claire text-marque" : "border-bordure text-doux hover:text-foreground"}`}
            >
              {f.libelle}
            </Link>
          ))}
        </nav>
        <nav aria-label="Sujet" className="flex flex-wrap gap-2 text-sm">
          <Link href={lien({ sujet: null })} className={!sujet ? "font-semibold text-marque" : "text-doux hover:text-foreground"}>
            Tous les sujets
          </Link>
          {Object.entries(SUJETS_RECLAMATION).map(([valeur, s]) => (
            <Link key={valeur} href={lien({ sujet: valeur })} className={sujet === valeur ? "font-semibold text-marque" : "text-doux hover:text-foreground"}>
              {s.libelle}
            </Link>
          ))}
        </nav>
      </div>

      <Carte sansMarge>
        {!reclamations?.length ? (
          <EtatVide icone={MessagesSquare} titre="Aucune réclamation" texte="Les salariés écrivent depuis leur espace, sur leur téléphone." />
        ) : (
          <ListeLignes>
            {reclamations.map((r) => {
              const statut = STATUTS_RECLAMATION[r.statut as StatutReclamation];
              const attente = r.attente_personnel && (r.statut === "ouverte" || r.statut === "en_cours");
              return (
                <Ligne
                  key={r.id}
                  href={`/espace/entreprises/${id}/reclamations/${r.id}`}
                  icone={MessagesSquare}
                  titre={r.objet}
                  sousTitre={`${champLie(r.salaries, "nom")} ${champLie(r.salaries, "prenoms")} · ${SUJETS_RECLAMATION[r.sujet as SujetReclamation].libelle} · ${formaterDate(r.derniere_activite)}`}
                  fin={
                    <>
                      {attente && <Badge teinte="ambre">Réponse attendue</Badge>}
                      <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
                    </>
                  }
                />
              );
            })}
          </ListeLignes>
        )}
      </Carte>
    </Page>
  );
}
