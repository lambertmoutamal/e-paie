import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Briefcase, Building2, Cake, CalendarOff, PartyPopper, Plus, ShieldCheck, Sparkles, Users } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie, valeurLiee } from "@/lib/supabase/relations";
import { libelleDates } from "@/lib/absences/regles";
import { MODULES } from "@/lib/modules";
import { CarteModule } from "@/components/carte-module";
import { CarteEcheances, type Echeance } from "@/components/echeances";
import { CarteActionsPaie } from "@/components/actions-paie";
import { Avatar } from "@/components/avatar";
import { mesActionsPaie, mesDemandesATraiter, mesReclamationsATraiter } from "@/lib/bulletins/actions-a-faire";
import { Badge, Carte, classesBouton, EtatVide, Ligne, ListeLignes, Page, Statistique } from "@/components/ui";

export const metadata: Metadata = { title: "Accueil" };

const JOUR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Libreville" });
const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

type SalarieMini = { id: string; entreprise_id: string; nom: string; prenoms: string; date_naissance: string | null; date_embauche: string };
type Evenement = { salarie: SalarieMini; date: Date; type: "anniversaire" | "anciennete"; annees: number };

// Prochains anniversaires et anniversaires d'embauche (30 jours)
function evenements(salaries: SalarieMini[], aujourdhui: Date): Evenement[] {
  const limite = new Date(aujourdhui.getTime() + 30 * 86_400_000);
  const resultat: Evenement[] = [];
  const prochaine = (iso: string) => {
    const [a, m, j] = iso.split("-").map(Number);
    let d = new Date(Date.UTC(aujourdhui.getUTCFullYear(), m - 1, j));
    if (d < new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()))) {
      d = new Date(Date.UTC(aujourdhui.getUTCFullYear() + 1, m - 1, j));
    }
    return { d, annees: d.getUTCFullYear() - a };
  };
  for (const s of salaries) {
    if (s.date_naissance) {
      const { d } = prochaine(s.date_naissance);
      if (d <= limite) resultat.push({ salarie: s, date: d, type: "anniversaire", annees: 0 });
    }
    const { d, annees } = prochaine(s.date_embauche);
    if (annees >= 1 && d <= limite) resultat.push({ salarie: s, date: d, type: "anciennete", annees });
  }
  return resultat.sort((x, y) => x.date.getTime() - y.date.getTime()).slice(0, 8);
}

export default async function Accueil() {
  const { supabase } = await exigerUtilisateur();
  const { profil, adminPlateforme, cabinets, affectations } = await droitsUtilisateur();
  const administrateur = adminPlateforme || cabinets.length > 0;
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);

  // La base limite automatiquement chaque lecture au périmètre de la personne.
  const [nbEntreprises, nbSalaries, { data: absents }, { data: salaries }, { data: echeancesBrutes }, actionsPaie, demandesATraiter, reclamationsATraiter] =
    await Promise.all([
      supabase.from("entreprises").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
      supabase.from("salaries").select("id", { count: "exact", head: true }).eq("statut", "actif").lte("date_embauche", aujourdhui).then((r) => r.count ?? 0),
      supabase
        .from("demandes_absence")
        .select("id, salarie_id, entreprise_id, debut, fin, salaries(nom, prenoms), types_absence(libelle)")
        .eq("statut", "acceptee")
        .lte("debut", aujourdhui)
        .gte("fin", aujourdhui)
        .limit(12),
      supabase.from("salaries").select("id, entreprise_id, nom, prenoms, date_naissance, date_embauche").eq("statut", "actif").limit(2000),
      supabase.rpc("echeances_contrats", { p_jours: 30 }),
      mesActionsPaie(),
      mesDemandesATraiter(),
      mesReclamationsATraiter(),
    ]);
  const echeances = (echeancesBrutes ?? []) as Echeance[];
  const aVenir = evenements((salaries ?? []) as SalarieMini[], maintenant);
  const nbActions = actionsPaie.length + demandesATraiter.length + reclamationsATraiter.length;

  const nom = profil?.nom_complet || profil?.email || "";
  const prenom = (profil?.nom_complet || "").split(" ")[0];
  const acces = [
    ...(adminPlateforme ? [{ cle: "plateforme", role: "admin_plateforme", perimetre: "Toute la plateforme", href: undefined, icone: ShieldCheck }] : []),
    ...cabinets.map((m) => ({ cle: `cabinet-${m.cabinet_id}`, role: m.role, perimetre: champLie(m.cabinets, "nom"), href: `/espace/cabinets/${m.cabinet_id}`, icone: Building2 })),
    ...affectations.map((a) => ({
      cle: `entreprise-${a.entreprise_id}-${a.role}`,
      role: a.role,
      perimetre: champLie(a.entreprises, "raison_sociale"),
      href: `/espace/entreprises/${a.entreprise_id}`,
      icone: Briefcase,
    })),
  ];

  return (
    <Page>
      {/* Bienvenue */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-marque-nuit via-marque-fonce to-marque px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
        <span aria-hidden className="absolute -right-10 -top-16 size-56 rounded-full bg-accent/30 blur-2xl" />
        <span aria-hidden className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar nom={nom || "?"} taille="grand" contour />
            <div>
              <p className="text-sm capitalize text-white/75">{JOUR_LONG.format(maintenant)}</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bonjour {prenom || ""} 👋</h1>
              <p className="mt-1 text-white/80">
                {nbActions > 0 ? (
                  <>
                    <strong className="text-white">{nbActions} action{nbActions > 1 ? "s" : ""}</strong> vous attend{nbActions > 1 ? "ent" : ""} aujourd&apos;hui.
                  </>
                ) : (
                  "Tout est à jour, rien ne vous attend. Bonne journée !"
                )}
              </p>
            </div>
          </div>
          {administrateur && (
            <div className="flex flex-wrap gap-2">
              {adminPlateforme && (
                <Link href="/espace/cabinets#nouveau" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-sm font-semibold hover:bg-white/10">
                  <Plus size={16} aria-hidden />
                  Nouveau cabinet
                </Link>
              )}
              <Link href="/espace/entreprises/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-marque-fonce shadow hover:bg-white/90">
                <Plus size={16} aria-hidden />
                Nouvelle entreprise
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Statistique icone={Briefcase} libelle="Entreprises" valeur={nbEntreprises} href="/espace/entreprises" teinte="indigo" />
        <Statistique icone={Users} libelle="Salariés en poste" valeur={nbSalaries} teinte="vert" />
        <Statistique icone={CalendarOff} libelle="Absents aujourd'hui" valeur={absents?.length ?? 0} teinte="ciel" />
        <Statistique icone={BellRing} libelle="Actions à faire" valeur={nbActions} href={nbActions ? "#a-faire" : undefined} teinte="corail" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {nbActions > 0 ? (
            <CarteActionsPaie actions={actionsPaie} demandes={demandesATraiter} reclamations={reclamationsATraiter} />
          ) : (
            <section id="a-faire" className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
              <span className="grid size-11 place-items-center rounded-full bg-emerald-500 text-white">
                <Sparkles size={20} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Rien à faire pour l&apos;instant</p>
                <p className="text-sm text-emerald-800/80">Les validations, demandes et réclamations qui vous attendent apparaîtront ici.</p>
              </div>
            </section>
          )}

          {echeances.length > 0 && <CarteEcheances echeances={echeances.slice(0, 8)} avecEntreprise />}

          {acces.length > 0 && (
            <section aria-labelledby="titre-modules" className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-2">
                <h2 id="titre-modules" className="text-lg font-semibold">
                  Modules
                </h2>
                <Link href="/espace/modules" className={classesBouton("discret", "petit")}>
                  Tous les modules
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODULES.slice(0, 4).map((m) => (
                  <CarteModule key={m.id} module={m} href={`/espace/modules/${m.id}`} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Carte titre="Qui est absent aujourd'hui" sansMarge>
            {!absents?.length ? (
              <p className="px-4 py-5 text-sm text-doux sm:px-5">Toute l&apos;équipe est présente.</p>
            ) : (
              <ul className="divide-y divide-bordure">
                {absents.map((a) => {
                  const nomComplet = `${valeurLiee(a.salaries, "prenoms") ?? ""} ${valeurLiee(a.salaries, "nom") ?? ""}`.trim();
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <Avatar nom={nomComplet} taille="petit" />
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium">{nomComplet}</p>
                        <p className="truncate text-xs text-doux">
                          {champLie(a.types_absence, "libelle")} · {libelleDates(a)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>

          <Carte titre="Anniversaires et ancienneté" description="Dans les 30 prochains jours" sansMarge>
            {!aVenir.length ? (
              <p className="px-4 py-5 text-sm text-doux sm:px-5">Aucun événement à venir.</p>
            ) : (
              <ul className="divide-y divide-bordure">
                {aVenir.map((e) => (
                  <li key={`${e.salarie.id}-${e.type}`}>
                    <Link href={`/espace/entreprises/${e.salarie.entreprise_id}/salaries/${e.salarie.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[.02] sm:px-5">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${e.type === "anniversaire" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                        {e.type === "anniversaire" ? <Cake size={17} aria-hidden /> : <PartyPopper size={17} aria-hidden />}
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium">
                          {e.salarie.prenoms} {e.salarie.nom}
                        </p>
                        <p className="truncate text-xs text-doux">
                          {e.type === "anniversaire" ? "Anniversaire" : `${e.annees} an${e.annees > 1 ? "s" : ""} dans l'entreprise`} · {JOUR_COURT.format(e.date)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <Carte titre="Mes accès" sansMarge>
            {acces.length === 0 ? (
              <EtatVide icone={Briefcase} titre="Aucun accès pour le moment" texte="Votre administrateur doit vous affecter à une entreprise." />
            ) : (
              <ListeLignes>
                {acces.map((a) => (
                  <Ligne
                    key={a.cle}
                    href={a.href}
                    icone={a.icone}
                    titre={a.perimetre}
                    fin={<Badge teinte={a.role.startsWith("admin") ? "vert" : "bleu"}>{libelleRole(a.role)}</Badge>}
                  />
                ))}
              </ListeLignes>
            )}
          </Carte>
        </div>
      </div>
    </Page>
  );
}
