import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inbox, Mail, Phone } from "lucide-react";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { Badge, Carte, classesBouton, EnTetePage, EtatVide, Page } from "@/components/ui";
import { basculerTraitement } from "./actions";

export const metadata: Metadata = { title: "Demandes de démo" };

const TYPES: Record<string, string> = { cabinet: "Cabinet comptable", entreprise: "Entreprise", autre: "Autre" };

export default async function PageDemandesDemo() {
  const { supabase } = await exigerUtilisateur();
  if (!(await estAdminPlateforme(supabase))) notFound();

  const { data: demandes } = await supabase
    .from("demandes_demo")
    .select("id, nom, structure, type, email, telephone, effectif, message, traitee_le, cree_le")
    .order("traitee_le", { ascending: false, nullsFirst: true })
    .order("cree_le", { ascending: false })
    .limit(100);
  const aTraiter = (demandes ?? []).filter((d) => !d.traitee_le).length;

  return (
    <Page>
      <EnTetePage
        titre="Demandes de démo"
        description={`${aTraiter} demande(s) à traiter, reçues depuis le site vitrine.`}
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />
      <Carte sansMarge>
        {!demandes?.length ? (
          <EtatVide icone={Inbox} titre="Aucune demande pour l'instant" texte="Les demandes du formulaire « Demander une démo » apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-bordure">
            {demandes.map((d) => (
              <li key={d.id} className={`flex flex-col gap-3 px-4 py-4 sm:px-5 ${d.traitee_le ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {d.nom} · {d.structure}
                    </p>
                    <p className="text-sm text-doux">
                      {TYPES[d.type] ?? d.type}
                      {d.effectif ? ` · ${d.effectif} salariés` : ""} · reçue le {formaterDate(d.cree_le)}
                    </p>
                  </div>
                  {d.traitee_le ? <Badge>Traitée</Badge> : <Badge teinte="ambre">À traiter</Badge>}
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1 font-medium text-marque">
                    <Mail size={14} aria-hidden /> {d.email}
                  </a>
                  {d.telephone && (
                    <a href={`tel:${d.telephone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-medium text-marque">
                      <Phone size={14} aria-hidden /> {d.telephone}
                    </a>
                  )}
                </div>
                {d.message && <p className="whitespace-pre-line rounded-lg bg-black/[.03] p-3 text-sm">{d.message}</p>}
                <form action={basculerTraitement.bind(null, d.id, !d.traitee_le)}>
                  <button type="submit" className={classesBouton("secondaire", "petit")}>
                    {d.traitee_le ? "Rouvrir" : "Marquer comme traitée"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </Page>
  );
}
