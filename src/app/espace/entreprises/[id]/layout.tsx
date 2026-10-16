import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { entrepriseCourante, entreprisesAccessibles } from "@/lib/entreprise-courante";
import { Carte, classesBouton, Page } from "@/components/ui";
import { basculerEntreprise } from "../../actions-navigation";

// Une seule entreprise à la fois : une page d'une autre entreprise (lien d'une alerte, adresse
// copiée…) ne s'ouvre qu'après avoir basculé sur cette entreprise.
export default async function GardeEntreprise({ children, params }: LayoutProps<"/espace/entreprises/[id]">) {
  const { id } = await params;
  const [liste, courante] = await Promise.all([entreprisesAccessibles(), entrepriseCourante()]);
  const cible = liste.find((e) => e.id === id);
  if (!cible) notFound();
  if (courante?.id === id) return children;

  return (
    <Page>
      <div className="mx-auto w-full max-w-xl py-6">
        <Carte titre="Cette page concerne une autre entreprise">
          <div className="flex flex-col gap-4">
            <p>
              Vous travaillez sur <strong>{courante?.raison_sociale ?? "aucune entreprise"}</strong>. Cette page concerne{" "}
              <strong>{cible.raison_sociale}</strong>. On ne travaille que sur une entreprise à la fois.
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={basculerEntreprise.bind(null, cible.id)}>
                <button type="submit" className={classesBouton()}>
                  <ArrowLeftRight size={16} aria-hidden />
                  Travailler sur {cible.raison_sociale}
                </button>
              </form>
              {courante && (
                <Link href="/espace" className={classesBouton("secondaire")}>
                  Rester sur {courante.raison_sociale}
                </Link>
              )}
            </div>
          </div>
        </Carte>
      </div>
    </Page>
  );
}
