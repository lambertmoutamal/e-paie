import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight, Bell, KeyRound, LogOut, Search, UserRound } from "lucide-react";
import { droitsUtilisateur } from "@/lib/auth/utilisateur";
import { messageBandeau } from "@/lib/abonnements/phases";
import { Logo } from "@/components/logo";
import { Squelette } from "@/components/ui";
import { seDeconnecter } from "../connexion/actions";
import { mesActionsPaie, mesDemandesATraiter, mesReclamationsATraiter } from "@/lib/bulletins/actions-a-faire";
import { BandeauActionsPaie } from "@/components/actions-paie";
import { entrepriseCourante, entreprisesAccessibles } from "@/lib/entreprise-courante";
import { groupesMenu } from "@/lib/menu";
import { MenuGroupes, MenuMobile } from "./navigation";

// Structure commune de l'espace privé : barre de navigation en haut (groupes de tâches
// avec menus déroulants, recherche, cloche des actions à faire, compte avec le
// changement d'entreprise), contenu au centre. Le cadre s'affiche immédiatement ; le reste dès que la
// session est vérifiée.
export default function MiseEnPageEspace({ children }: LayoutProps<"/espace">) {
  return (
    <div className="flex h-dvh flex-col print:block print:h-auto">
      <header className="sticky top-0 z-20 print:hidden bg-gradient-to-r from-marque-nuit via-marque-fonce to-marque text-white shadow-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 lg:gap-6 lg:px-8">
          <Link href="/espace" aria-label="Accueil" className="shrink-0">
            <Logo clair taille={30} />
          </Link>
          <nav aria-label="Menu principal" className="hidden min-w-0 flex-1 lg:block">
            <Suspense fallback={null}>
              <Menu variante="haut" />
            </Suspense>
          </nav>
          <span className="flex-1 lg:hidden" />
          <form action="/espace/recherche" role="search" className="relative hidden xl:block">
            <label htmlFor="recherche-salarie" className="sr-only">
              Rechercher un salarié
            </label>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70" aria-hidden />
            <input
              id="recherche-salarie"
              name="q"
              placeholder="Rechercher un salarié…"
              className="h-10 w-44 rounded-full border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/60 focus:w-64 focus:bg-white/20 focus:ring-2 focus:ring-white/40 transition-all"
            />
          </form>
          <Link href="/espace/recherche" className="grid size-10 place-items-center rounded-full hover:bg-white/10 xl:hidden" aria-label="Rechercher un salarié">
            <Search size={19} aria-hidden />
          </Link>
          <Suspense fallback={<span className="size-10" />}>
            <Cloche />
          </Suspense>
          <Suspense fallback={<span className="size-10" />}>
            <MenuUtilisateur />
          </Suspense>
          <Suspense fallback={null}>
            <Menu variante="mobile" />
          </Suspense>
        </div>
      </header>

      <div className="print:hidden">
        <Suspense fallback={null}>
          <BandeauAbonnement />
        </Suspense>
        <Suspense fallback={null}>
          <BandeauActions />
        </Suspense>
      </div>

      {/* Le contenu défile sous la barre ; le tableau de bord, lui, occupe exactement la place restante */}
      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5 lg:px-8 print:overflow-visible">
        <div className="mx-auto w-full max-w-6xl">
          <Suspense fallback={<Squelette />}>{children}</Suspense>
        </div>
      </main>

    </div>
  );
}

async function Menu({ variante }: { variante: "haut" | "mobile" }) {
  const [{ adminPlateforme, cabinets, abonnements }, courante] = await Promise.all([droitsUtilisateur(), entrepriseCourante()]);
  const groupes = groupesMenu({
    entrepriseId: courante?.id ?? null,
    adminPlateforme,
    administrateur: adminPlateforme || cabinets.length > 0,
    voitAbonnement: adminPlateforme || abonnements.length > 0,
  });
  return variante === "haut" ? <MenuGroupes groupes={groupes} /> : <MenuMobile groupes={groupes} />;
}

// Cloche : nombre d'actions qui attendent la personne (validations, demandes, réclamations).
async function Cloche() {
  const [actions, demandes, reclamations] = await Promise.all([mesActionsPaie(), mesDemandesATraiter(), mesReclamationsATraiter()]);
  const nombre = actions.length + demandes.length + reclamations.length;
  return (
    <Link
      href="/espace/a-faire"
      className="relative grid size-10 place-items-center rounded-full hover:bg-white/10"
      aria-label={nombre ? `${nombre} action(s) à faire` : "Aucune action à faire"}
      title={nombre ? `${nombre} action(s) à faire` : "Aucune action à faire"}
    >
      <Bell size={19} aria-hidden />
      {nombre > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white ring-2 ring-marque-fonce">
          {nombre > 99 ? "99+" : nombre}
        </span>
      )}
    </Link>
  );
}

// Rappel permanent des validations, demandes et réclamations qui attendent la personne.
async function BandeauActions() {
  const [actions, demandes, reclamations] = await Promise.all([mesActionsPaie(), mesDemandesATraiter(), mesReclamationsATraiter()]);
  const nombre = actions.length + demandes.length + reclamations.length;
  return nombre ? <BandeauActionsPaie nombre={nombre} /> : null;
}

// Bandeau d'information sur l'abonnement (essai, lecture seule, blocage).
// Non affiché pour l'administrateur plateforme, qui voit tous les abonnements.
async function BandeauAbonnement() {
  const { adminPlateforme, abonnements } = await droitsUtilisateur();
  if (adminPlateforme) return null;
  const messages = abonnements.map(messageBandeau).filter((m) => m !== null);
  if (!messages.length) return null;

  const couleurs = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    alerte: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className="flex flex-col">
      {messages.map((m) => (
        <div key={m.texte} role="status" className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm lg:px-8 ${couleurs[m.niveau]}`}>
          <span>{m.texte}</span>
          <Link href="/espace/abonnement" className="font-semibold underline">
            Passer à Pro
          </Link>
        </div>
      ))}
    </div>
  );
}

// Avatar et menu du compte (entreprise de travail, profil, mot de passe, déconnexion), sans JavaScript.
async function MenuUtilisateur() {
  const [{ profil }, liste, courante] = await Promise.all([droitsUtilisateur(), entreprisesAccessibles(), entrepriseCourante()]);
  const nom: string = profil?.nom_complet || profil?.email || "";
  const initiales = nom
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m: string) => m[0]?.toUpperCase())
    .join("");

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 hover:bg-white/10" aria-label="Mon compte">
        <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-white ring-2 ring-white/40">{initiales}</span>
      </summary>
      <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-bordure bg-surface text-foreground shadow-xl">
        <div className="border-b border-bordure bg-marque-claire/60 px-4 py-3">
          <p className="truncate font-semibold">{profil?.nom_complet || "Mon compte"}</p>
          <p className="truncate text-xs text-doux">{profil?.email}</p>
        </div>
        {liste.length > 1 && (
          <div className="border-b border-bordure px-4 py-2.5 text-sm">
            <p className="text-xs text-doux">Entreprise de travail</p>
            <p className="truncate font-semibold">{courante?.raison_sociale ?? "Toutes mes entreprises"}</p>
            <Link href="/espace/choisir-entreprise" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-marque hover:underline">
              <ArrowLeftRight size={14} aria-hidden />
              Changer d&apos;entreprise
            </Link>
          </div>
        )}
        <ul className="py-1 text-sm">
          <li>
            <Link href="/espace/profil" className="flex items-center gap-2 px-4 py-2 hover:bg-black/[.04]">
              <UserRound size={16} className="text-doux" aria-hidden />
              Mon profil
            </Link>
          </li>
          <li>
            <Link href="/espace/mot-de-passe" className="flex items-center gap-2 px-4 py-2 hover:bg-black/[.04]">
              <KeyRound size={16} className="text-doux" aria-hidden />
              Changer mon mot de passe
            </Link>
          </li>
          <li className="border-t border-bordure">
            <form action={seDeconnecter}>
              <button type="submit" className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-700 hover:bg-red-50">
                <LogOut size={16} aria-hidden />
                Se déconnecter
              </button>
            </form>
          </li>
        </ul>
      </div>
    </details>
  );
}
