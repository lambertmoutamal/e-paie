import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, CircleCheck, Clock } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { moduleParId } from "@/lib/modules";
import { champLie } from "@/lib/supabase/relations";
import { ICONES_MODULES } from "@/components/icone-module";
import { Badge, Carte, EnTetePage, EtatVide, Ligne, ListeLignes, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Module" };

export default async function PageModule({ params }: PageProps<"/espace/modules/[id]">) {
  const { id } = await params;
  const mod = moduleParId(id);
  if (!mod) notFound();
  const Icone = ICONES_MODULES[mod.id];
  const disponible = mod.statut === "disponible";

  // Entreprises accessibles (la RLS filtre) pour ouvrir le module sur l'une d'elles.
  const { supabase } = await exigerUtilisateur();
  const { data: entreprises } = disponible
    ? await supabase.from("entreprises").select("id, raison_sociale, cabinets(nom)").eq("statut", "active").order("raison_sociale")
    : { data: [] };

  return (
    <Page>
      <EnTetePage
        titre={mod.nom}
        description={mod.accroche}
        fil={[
          { href: "/espace", libelle: "Tableau de bord" },
          { href: "/espace/modules", libelle: "Modules" },
        ]}
        actions={disponible ? <Badge teinte="vert">Disponible</Badge> : <Badge>Bientôt</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Carte titre="Fonctionnalités">
            <ul className="flex flex-col gap-3 text-sm">
              {mod.fonctions.map((f) => (
                <li key={f.libelle} className="flex items-start gap-2">
                  {f.disponible ? (
                    <CircleCheck size={18} className="mt-0.5 shrink-0 text-marque" aria-hidden />
                  ) : (
                    <Clock size={18} className="mt-0.5 shrink-0 text-doux" aria-hidden />
                  )}
                  <span className={f.disponible ? "" : "text-doux"}>
                    {f.libelle}
                    {!f.disponible && " (bientôt)"}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </div>

        <div className="lg:col-span-3">
          {disponible && mod.lienEntreprise ? (
            <Carte titre="Ouvrir pour une entreprise" sansMarge>
              {!entreprises?.length ? (
                <EtatVide icone={Briefcase} titre="Aucune entreprise accessible" />
              ) : (
                <ListeLignes>
                  {entreprises.map((e) => (
                    <Ligne
                      key={e.id}
                      href={mod.lienEntreprise!(e.id)}
                      icone={Briefcase}
                      titre={e.raison_sociale}
                      sousTitre={e.cabinets ? `Cabinet ${champLie(e.cabinets, "nom")}` : "Entreprise autonome"}
                    />
                  ))}
                </ListeLignes>
              )}
            </Carte>
          ) : (
            <Carte>
              <EtatVide
                icone={Icone}
                titre="Ce module arrive bientôt"
                texte="Il fait partie des prochaines étapes de développement d'e-Paie. Vous serez informé dès sa mise en service."
              />
            </Carte>
          )}
        </div>
      </div>
    </Page>
  );
}
