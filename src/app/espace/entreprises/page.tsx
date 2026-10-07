import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { champLie } from "@/lib/supabase/relations";
import { Chargement, EnTete, PageEspace, Vide } from "@/components/mise-en-page";

export const metadata: Metadata = { title: "Entreprises" };

export default function PageEntreprises() {
  return (
    <PageEspace>
      <EnTete titre="Entreprises" retour={{ href: "/espace", libelle: "Mon espace" }} />
      <Suspense fallback={<Chargement />}>
        <ListeEntreprises />
      </Suspense>
    </PageEspace>
  );
}

async function ListeEntreprises() {
  const { supabase, utilisateur } = await exigerUtilisateur();

  // La RLS ne renvoie que les entreprises auxquelles la personne a accès.
  const [{ data: entreprises }, adminPlateforme, { data: cabinets }] = await Promise.all([
    supabase.from("entreprises").select("id, raison_sociale, statut, cabinets(nom)").order("raison_sociale"),
    estAdminPlateforme(supabase),
    supabase.from("membres_cabinet").select("cabinet_id").eq("profil_id", utilisateur.id),
  ]);
  const peutCreer = adminPlateforme || (cabinets?.length ?? 0) > 0;

  return (
    <>
      {peutCreer && (
        <Link
          href="/espace/entreprises/nouvelle"
          className="self-start rounded-lg bg-marque px-4 py-2 text-sm font-semibold text-white"
        >
          + Nouvelle entreprise
        </Link>
      )}

      {!entreprises?.length ? (
        <Vide>Aucune entreprise accessible pour le moment.</Vide>
      ) : (
        <ul className="flex flex-col gap-2">
          {entreprises.map((e) => (
            <li key={e.id}>
              <Link href={`/espace/entreprises/${e.id}`} className="block rounded-xl border border-black/10 bg-white p-4">
                <p className="font-semibold">{e.raison_sociale}</p>
                <p className="text-sm text-foreground/70">
                  {e.cabinets ? `Cabinet : ${champLie(e.cabinets, "nom")}` : "Sans cabinet (autonome)"}
                  {e.statut === "archivee" ? " · Archivée" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
