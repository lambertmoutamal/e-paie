import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { EnTetePage } from "@/components/ui";

export type Onglet = "demandes" | "planning" | "soldes" | "reglages";

// Données communes aux pages « Congés et absences » (la RLS filtre l'accès).
export async function chargerContexte(entrepriseId: string) {
  const { supabase } = await exigerUtilisateur();
  const [{ data: entreprise }, { data: peutGerer }, { data: peutPrevoir }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", entrepriseId).maybeSingle(),
    supabase.rpc("peut_gerer_absences", { p_entreprise_id: entrepriseId }),
    supabase.rpc("peut_prevoir_conges", { p_entreprise_id: entrepriseId }),
  ]);
  if (!entreprise) notFound();
  return { supabase, entreprise, peutGerer: peutGerer === true, peutPrevoir: peutPrevoir === true };
}

export function EnTeteAbsences({ entrepriseId, raisonSociale, onglet }: { entrepriseId: string; raisonSociale: string; onglet: Onglet }) {
  const base = `/espace/entreprises/${entrepriseId}/absences`;
  const onglets: { cle: Onglet; libelle: string; href: string }[] = [
    { cle: "demandes", libelle: "Demandes", href: base },
    { cle: "planning", libelle: "Planning", href: `${base}/planning` },
    { cle: "soldes", libelle: "Soldes", href: `${base}/soldes` },
    { cle: "reglages", libelle: "Réglages", href: `${base}/reglages` },
  ];
  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre="Congés et absences"
        description={raisonSociale}
        fil={[
          { href: "/espace/entreprises", libelle: "Entreprises" },
          { href: `/espace/entreprises/${entrepriseId}`, libelle: raisonSociale },
        ]}
      />
      <nav aria-label="Congés et absences" className="flex gap-1 overflow-x-auto border-b border-bordure">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={o.href}
            aria-current={o.cle === onglet ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              o.cle === onglet ? "border-marque text-marque" : "border-transparent text-doux hover:text-foreground"
            }`}
          >
            {o.libelle}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function lienJustificatif(chemin: string) {
  return `/espace/fichiers?espace=absences&chemin=${encodeURIComponent(chemin)}`;
}
