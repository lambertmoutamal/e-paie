import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, TrendingDown, TrendingUp, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { valeurLiee } from "@/lib/supabase/relations";
import { TYPES_CONTRAT } from "@/lib/contrats/regles";
import { SUJETS_RECLAMATION } from "@/lib/reclamations/regles";
import { exigerEntrepriseCourante, idEntrepriseMemorise } from "@/lib/entreprise-courante";
import { absencesDuMois, compter, evolutionEffectif, pyramideDesAges, repartitionSexe, type AbsenceStat, type SalarieStat } from "@/lib/tableau-de-bord/calculs";
import type { Echeance } from "@/components/echeances";
import { GraphiqueAnneau, GraphiqueBarresHorizontales, GraphiqueEffectif, GraphiquePyramide } from "@/components/graphiques-dynamiques";

export const metadata: Metadata = { title: "Tableau de bord" };

const JOUR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Libreville" });

const TEINTES = {
  indigo: "bg-indigo-50 text-indigo-600",
  vert: "bg-emerald-50 text-emerald-600",
  corail: "bg-accent-claire text-accent",
  ambre: "bg-amber-50 text-amber-600",
  ciel: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
};

function Indicateur({ icone: Icone, libelle, valeur, detail, teinte, href }: { icone: LucideIcon; libelle: string; valeur: string | number; detail?: string; teinte: keyof typeof TEINTES; href?: string }) {
  const contenu = (
    <>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TEINTES[teinte]}`}>
        <Icone size={19} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-tight tracking-tight tabular-nums">{valeur}</span>
        <span className="block truncate text-xs font-medium text-doux">{libelle}</span>
      </span>
    </>
  );
  const classes = "flex items-center gap-2.5 rounded-2xl border border-bordure bg-surface px-3.5 py-3 shadow-carte";
  return href ? (
    <Link href={href} title={detail} className={`${classes} transition motion-safe:hover:-translate-y-0.5 hover:border-marque/30 hover:shadow-survol`}>
      {contenu}
    </Link>
  ) : (
    <div title={detail} className={classes}>
      {contenu}
    </div>
  );
}

// Carte de graphique : sur ordinateur, le graphique remplit la place restante
function CarteGraphique({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-bordure bg-surface p-3.5 shadow-carte">
      <h2 className="truncate text-sm font-semibold">
        {titre}
        {sousTitre && <span className="font-normal text-doux"> · {sousTitre}</span>}
      </h2>
      <div className="mt-2 h-56 min-h-0 lg:h-auto lg:flex-1">{children}</div>
    </section>
  );
}

type SalarieMini = SalarieStat & { entreprise_id: string; date_naissance: string | null };

export default async function TableauDeBord() {
  const [{ supabase }, idMemorise] = await Promise.all([exigerUtilisateur(), idEntrepriseMemorise()]);
  const perimetre = [idMemorise];
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const debutMois = `${aujourdhui.slice(0, 8)}01`;

  // Toutes les lectures sont limitées par la base au périmètre de la personne
  // Lancées en même temps que la vérification de l'entreprise (une seule attente au lieu de deux)
  const [courante, { data: salariesBruts }, { data: contrats }, { data: absencesBrutes }, { data: reclamations }, { data: echeancesBrutes }] =
    await Promise.all([
      // Une seule entreprise à la fois : celle choisie à la connexion (sinon, écran de choix)
      exigerEntrepriseCourante(),
      supabase.from("salaries").select("entreprise_id, sexe, date_naissance, date_embauche, date_sortie, statut").in("entreprise_id", perimetre).limit(5000),
      supabase.from("contrats").select("type_contrat").in("entreprise_id", perimetre).eq("statut", "en_cours").neq("nature", "avenant").limit(5000),
      supabase
        .from("demandes_absence")
        .select("debut, fin, nb_jours, types_absence(libelle)")
        .in("entreprise_id", perimetre)
        .eq("statut", "acceptee")
        .lte("debut", `${aujourdhui.slice(0, 8)}31`)
        .gte("fin", debutMois)
        .limit(5000),
      supabase.from("reclamations").select("sujet").in("entreprise_id", perimetre).in("statut", ["ouverte", "en_cours"]).limit(2000),
      supabase.rpc("echeances_contrats", { p_jours: 30 }),
    ]);

  const salaries = (salariesBruts ?? []) as SalarieMini[];
  const effectif = evolutionEffectif(salaries, maintenant);
  const ceMois = effectif.at(-1)!;
  const absences = absencesDuMois(
    ((absencesBrutes ?? []) as { debut: string; fin: string; nb_jours: number; types_absence: unknown }[]).map(
      (a): AbsenceStat => ({ debut: a.debut, fin: a.fin, nb_jours: a.nb_jours, type: valeurLiee(a.types_absence, "libelle") ?? "Autre" }),
    ),
    salaries,
    maintenant,
  );
  const echeances = ((echeancesBrutes ?? []) as Echeance[]).filter((e) => perimetre.includes(e.entreprise_id));
  const finsCdd = echeances.filter((e) => e.nature === "fin_contrat").length;
  const pyramide = pyramideDesAges(salaries, maintenant);
  const lien = (chemin: string) => `/espace/entreprises/${courante.id}${chemin}`;

  return (
    <div className="flex flex-col gap-3 lg:absolute lg:inset-0 lg:mx-auto lg:max-w-7xl lg:px-8 lg:pb-5 lg:pt-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-bold tracking-tight">
          Tableau de bord <span className="font-semibold text-marque">· {courante.raison_sociale}</span>
        </h1>
        <p className="text-sm capitalize text-doux">{JOUR_LONG.format(maintenant)}</p>
      </header>

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Indicateur icone={Users} libelle="Effectif" valeur={ceMois.effectif} detail="Salariés en poste aujourd'hui" teinte="indigo" href={lien("/salaries")} />
        <Indicateur icone={TrendingUp} libelle="Entrées du mois" valeur={ceMois.entrees} detail={`${effectif.reduce((s, m) => s + m.entrees, 0)} sur 12 mois`} teinte="vert" href="/espace/etats/entrees-sorties" />
        <Indicateur icone={TrendingDown} libelle="Sorties du mois" valeur={ceMois.sorties} detail={`${effectif.reduce((s, m) => s + m.sorties, 0)} sur 12 mois`} teinte="corail" href="/espace/etats/entrees-sorties" />
        <Indicateur icone={CalendarClock} libelle="Fins de CDD" valeur={finsCdd} detail={`Dans les 30 jours (et ${echeances.length - finsCdd} fin(s) d'essai)`} teinte="corail" href="/espace/etats/contrats" />
      </div>

      {/* Graphiques : remplissent l'écran, sans défilement */}
      <div className="grid gap-3 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-2">
        <CarteGraphique titre="Évolution de l'effectif" sousTitre="12 derniers mois">
          <GraphiqueEffectif donnees={effectif} />
        </CarteGraphique>
        <CarteGraphique titre="Pyramide des âges" sousTitre={pyramide.sansDate ? `${pyramide.sansDate} sans date de naissance ou sexe` : "salariés en poste"}>
          <GraphiquePyramide donnees={pyramide.tranches} />
        </CarteGraphique>
        <CarteGraphique titre="Contrats en cours" sousTitre="par type">
          <GraphiqueAnneau donnees={compter(contrats ?? [], (c) => c.type_contrat, TYPES_CONTRAT)} />
        </CarteGraphique>
        <CarteGraphique titre="Hommes et femmes" sousTitre="salariés en poste">
          <GraphiqueAnneau donnees={repartitionSexe(salaries, maintenant)} />
        </CarteGraphique>
        <CarteGraphique titre="Absences du mois" sousTitre="jours par type">
          <GraphiqueBarresHorizontales donnees={absences.parType.map((a) => ({ nom: a.type, valeur: a.jours }))} unite=" j" />
        </CarteGraphique>
        <CarteGraphique titre="Réclamations ouvertes" sousTitre="par sujet">
          <GraphiqueBarresHorizontales
            donnees={compter(reclamations ?? [], (r) => r.sujet, Object.fromEntries(Object.entries(SUJETS_RECLAMATION).map(([k, v]) => [k, v.libelle])))}
          />
        </CarteGraphique>
      </div>
    </div>
  );
}
