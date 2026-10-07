import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie } from "@/lib/supabase/relations";
import { Chargement, PageEspace, Section } from "@/components/mise-en-page";
import { seDeconnecter } from "../connexion/actions";

export const metadata: Metadata = { title: "Mon espace" };

// Le cadre de la page s'affiche tout de suite ; la partie propre à la personne
// connectée arrive juste après (utile sur une connexion lente).
export default function PageAccueilEspace() {
  return (
    <PageEspace>
      <p className="text-sm font-semibold uppercase tracking-wide text-marque">e-Paie</p>

      <Suspense fallback={<Chargement />}>
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
    </PageEspace>
  );
}

type Acces = { cle: string; role: string; perimetre: string; lien?: string };

async function ContenuEspace() {
  const { supabase, utilisateur } = await exigerUtilisateur();

  // Toutes ces lectures passent par les règles RLS de la base.
  const [{ data: profil }, { data: cabinets }, { data: affectations }] = await Promise.all([
    supabase
      .from("profils")
      .select("nom_complet, email, est_admin_plateforme")
      .eq("id", utilisateur.id)
      .single(),
    supabase.from("membres_cabinet").select("role, cabinet_id, cabinets(nom)").eq("profil_id", utilisateur.id),
    supabase
      .from("affectations")
      .select("role, entreprise_id, entreprises(raison_sociale)")
      .eq("profil_id", utilisateur.id)
      .eq("actif", true),
  ]);

  const adminPlateforme = profil?.est_admin_plateforme === true;
  const adminCabinet = (cabinets ?? []).length > 0;

  const acces: Acces[] = [
    ...(adminPlateforme
      ? [{ cle: "plateforme", role: "admin_plateforme", perimetre: "Toute la plateforme" }]
      : []),
    ...(cabinets ?? []).map((m) => ({
      cle: `cabinet-${m.cabinet_id}`,
      role: m.role,
      perimetre: champLie(m.cabinets, "nom"),
      lien: `/espace/cabinets/${m.cabinet_id}`,
    })),
    ...(affectations ?? []).map((a) => ({
      cle: `entreprise-${a.entreprise_id}-${a.role}`,
      role: a.role,
      perimetre: champLie(a.entreprises, "raison_sociale"),
      lien: `/espace/entreprises/${a.entreprise_id}`,
    })),
  ];

  const menu = [
    ...(adminPlateforme ? [{ href: "/espace/cabinets", libelle: "Cabinets", texte: "Créer et gérer les cabinets" }] : []),
    ...(adminPlateforme || adminCabinet || acces.length > 0
      ? [{ href: "/espace/entreprises", libelle: "Entreprises", texte: "Fiches entreprises et utilisateurs" }]
      : []),
    { href: "/espace/profil", libelle: "Mon profil", texte: "Nom et mot de passe" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Bonjour {profil?.nom_complet || profil?.email}</h1>

      <nav aria-label="Menu" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {menu.map((m) => (
          <Link key={m.href} href={m.href} className="rounded-xl border border-black/10 bg-white p-4">
            <p className="font-semibold text-marque">{m.libelle}</p>
            <p className="text-sm text-foreground/70">{m.texte}</p>
          </Link>
        ))}
      </nav>

      <Section titre="Mes accès">
        {acces.length === 0 ? (
          <p className="rounded-xl border border-black/10 bg-white p-4 text-sm text-foreground/70">
            Aucun accès pour le moment. Votre administrateur doit vous affecter à une entreprise.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {acces.map((a) => {
              const contenu = (
                <>
                  <p className="font-medium">{libelleRole(a.role)}</p>
                  <p className="text-sm text-foreground/70">{a.perimetre}</p>
                </>
              );
              return (
                <li key={a.cle}>
                  {a.lien ? (
                    <Link href={a.lien} className="block rounded-xl border border-black/10 bg-white p-4">
                      {contenu}
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-black/10 bg-white p-4">{contenu}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
