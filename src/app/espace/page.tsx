import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { libelleRole } from "@/lib/auth/roles";
import { seDeconnecter } from "../connexion/actions";

export const metadata: Metadata = { title: "Mon espace" };

// Le cadre de la page s'affiche tout de suite ; la partie propre à la personne
// connectée arrive juste après (utile sur une connexion lente).
export default function PageEspace() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-marque">e-Paie</p>

      <Suspense fallback={<p className="text-foreground/60">Chargement de votre espace…</p>}>
        <ContenuEspace />
      </Suspense>

      <form action={seDeconnecter} className="mt-auto">
        <button
          type="submit"
          className="w-full rounded-lg border border-black/20 bg-white px-4 py-3 font-medium"
        >
          Se déconnecter
        </button>
      </form>
    </main>
  );
}

type Acces = { cle: string; role: string; perimetre: string };

async function ContenuEspace() {
  const supabase = await clientSupabaseServeur();
  const { data: session } = await supabase.auth.getClaims();
  const idUtilisateur = session?.claims?.sub;
  if (!idUtilisateur) redirect("/connexion");

  // Toutes ces lectures passent par les règles RLS de la base.
  const [{ data: profil }, { data: cabinets }, { data: affectations }] = await Promise.all([
    supabase
      .from("profils")
      .select("nom_complet, email, est_admin_plateforme")
      .eq("id", idUtilisateur)
      .single(),
    supabase.from("membres_cabinet").select("role, cabinets(nom)").eq("profil_id", idUtilisateur),
    supabase
      .from("affectations")
      .select("role, entreprises(raison_sociale)")
      .eq("profil_id", idUtilisateur)
      .eq("actif", true),
  ]);

  const acces: Acces[] = [
    ...(profil?.est_admin_plateforme
      ? [{ cle: "plateforme", role: "admin_plateforme", perimetre: "Toute la plateforme" }]
      : []),
    ...(cabinets ?? []).map((m, i) => ({
      cle: `cabinet-${i}`,
      role: m.role,
      perimetre: nomLie(m.cabinets, "nom"),
    })),
    ...(affectations ?? []).map((a, i) => ({
      cle: `entreprise-${i}`,
      role: a.role,
      perimetre: nomLie(a.entreprises, "raison_sociale"),
    })),
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Bonjour {profil?.nom_complet || profil?.email}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mes accès</h2>
        {acces.length === 0 ? (
          <p className="rounded-xl border border-black/10 bg-white p-4 text-sm text-foreground/70">
            Aucun accès pour le moment. Votre administrateur doit vous affecter à une entreprise.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {acces.map((a) => (
              <li key={a.cle} className="rounded-xl border border-black/10 bg-white p-4">
                <p className="font-medium">{libelleRole(a.role)}</p>
                <p className="text-sm text-foreground/70">{a.perimetre}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// Supabase renvoie la table liée sous forme d'objet ou de liste selon le cas.
function nomLie(lie: unknown, champ: string): string {
  const objet = (Array.isArray(lie) ? lie[0] : lie) as Record<string, string> | null;
  return objet?.[champ] ?? "—";
}
