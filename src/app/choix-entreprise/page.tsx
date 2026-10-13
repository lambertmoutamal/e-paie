import type { Metadata } from "next";
import { Suspense } from "react";
import { Briefcase, LogOut, Plus } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { Carte, EtatVide, LienBouton, Squelette } from "@/components/ui";
import { entreprisesAccessibles } from "@/lib/entreprise-courante";
import { Logo } from "@/components/logo";
import { seDeconnecter } from "../connexion/actions";
import { ListeChoixEntreprises } from "./liste";

export const metadata: Metadata = { title: "Choisir l'entreprise" };

// Écran affiché après la connexion : la ou les entreprises auxquelles la personne a accès.
// Il est hors de l'espace de travail : ni menus, ni recherche, ni accès aux pages tant
// qu'aucune entreprise n'est choisie. Seule la déconnexion reste possible.
export default function PageChoisirEntreprise() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-gradient-to-r from-marque-nuit via-marque-fonce to-marque text-white shadow-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 lg:px-8">
          <Logo clair taille={30} />
          <form action={seDeconnecter}>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/90 hover:bg-white/10">
              <LogOut size={16} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 pb-10 pt-8 lg:px-8">
        <Suspense fallback={<Squelette />}>
          <ChoixEntreprise />
        </Suspense>
      </main>
    </div>
  );
}

async function ChoixEntreprise() {
  const { supabase } = await exigerUtilisateur();
  const liste = await entreprisesAccessibles();
  if (liste.length === 0) {
    const { adminPlateforme, cabinets } = await droitsUtilisateur();
    return (
      <div className="mx-auto max-w-xl py-6">
        <Carte>
          <EtatVide
            icone={Briefcase}
            titre="Aucune entreprise ne vous est encore affectée"
            texte="Demandez à l'administrateur de votre cabinet de vous donner accès à une entreprise."
            action={
              (adminPlateforme || cabinets.length > 0) && (
                <LienBouton href="/espace/entreprises/nouvelle" icone={Plus}>
                  Créer une entreprise
                </LienBouton>
              )
            }
          />
        </Carte>
      </div>
    );
  }

  // Nombre de salariés en poste par entreprise (la base limite aux entreprises accessibles)
  const { data: salaries } = await supabase.from("salaries").select("entreprise_id").eq("statut", "actif").limit(10000);
  const effectifs = new Map<string, number>();
  for (const s of salaries ?? []) effectifs.set(s.entreprise_id, (effectifs.get(s.entreprise_id) ?? 0) + 1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{liste.length > 1 ? "Sur quelle entreprise voulez-vous travailler ?" : "Votre entreprise"}</h1>
        <p className="mt-1 text-doux">
          {liste.length > 1
            ? `Vous avez accès à ${liste.length} entreprises. Vous pourrez en changer à tout moment depuis le menu de votre compte (vos initiales, en haut à droite).`
            : "Voici l'entreprise à laquelle vous avez accès. Cliquez dessus pour commencer."}
        </p>
      </header>
      <ListeChoixEntreprises entreprises={liste.map((e) => ({ ...e, effectif: effectifs.get(e.id) ?? 0 }))} />
    </div>
  );
}
