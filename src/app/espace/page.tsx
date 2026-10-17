import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BellRing, CalendarClock, CalendarDays, ChevronRight, CircleCheck, FileSignature, MessagesSquare, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { valeurLiee } from "@/lib/supabase/relations";
import { TYPES_CONTRAT } from "@/lib/contrats/regles";
import { SUJETS_RECLAMATION } from "@/lib/reclamations/regles";
import { exigerEntrepriseCourante, idEntrepriseMemorise } from "@/lib/entreprise-courante";
import { absencesDuMois, compter, evolutionEffectif, pyramideDesAges, repartitionSexe, type AbsenceStat, type SalarieStat } from "@/lib/tableau-de-bord/calculs";
import { mesTachesEntrepriseCourante } from "@/lib/bulletins/actions-a-faire";
import { EtatVide, LienBouton } from "@/components/ui";
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
function CarteGraphique({ titre, sousTitre, vide, children }: { titre: string; sousTitre?: string; vide?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-bordure bg-surface p-3.5 shadow-carte">
      <h2 className="truncate text-sm font-semibold">
        {titre}
        {sousTitre && <span className="font-normal text-doux"> · {sousTitre}</span>}
      </h2>
      <div className="mt-2 h-60 min-h-0">{vide ?? children}</div>
    </section>
  );
}

// Carte « À faire aujourd'hui » : ce qui attend la personne, en gros compteurs cliquables
function CarteAFaire({
  paie,
  demandes,
  reclamations,
  ailleurs,
  lienPaie,
  lienAbsences,
  lienReclamations,
}: {
  paie: { aValider: number; aPublier: number; aCorriger: number };
  demandes: number;
  reclamations: number;
  ailleurs: number;
  lienPaie: string;
  lienAbsences: string;
  lienReclamations: string;
}) {
  const paieTotal = paie.aValider + paie.aPublier + paie.aCorriger;
  const total = paieTotal + demandes + reclamations;
  const detailPaie = [paie.aValider && `${paie.aValider} à valider`, paie.aPublier && `${paie.aPublier} à publier`, paie.aCorriger && `${paie.aCorriger} à corriger`].filter(Boolean).join(" · ");
  const elements = [
    { icone: FileSignature, libelle: "Paies à traiter", valeur: paieTotal, detail: detailPaie || "Rien en attente", href: lienPaie },
    { icone: CalendarDays, libelle: "Demandes de congés", valeur: demandes, detail: demandes ? "À accepter ou refuser" : "Rien en attente", href: lienAbsences },
    { icone: MessagesSquare, libelle: "Réclamations", valeur: reclamations, detail: reclamations ? "Salariés qui attendent une réponse" : "Rien en attente", href: lienReclamations },
  ];
  return (
    <section aria-labelledby="titre-a-faire" className={`rounded-2xl border bg-surface shadow-carte ${total ? "border-amber-300" : "border-bordure"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className={`grid size-10 place-items-center rounded-xl ${total ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
            {total ? <BellRing size={19} aria-hidden /> : <CircleCheck size={19} aria-hidden />}
          </span>
          <div>
            <h2 id="titre-a-faire" className="text-base font-semibold tracking-tight">À faire aujourd&apos;hui</h2>
            <p className="text-sm text-doux">{total ? `${total} chose${total > 1 ? "s" : ""} vous attend${total > 1 ? "ent" : ""}.` : "Rien à faire, tout est à jour."}</p>
          </div>
        </div>
        {total > 0 && (
          <Link href="/espace/a-faire" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-marque hover:underline">
            Tout voir <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </div>
      <ul className="grid gap-2.5 p-4 sm:grid-cols-3 sm:px-5">
        {elements.map((e) => (
          <li key={e.libelle}>
            <Link
              href={e.href}
              className={`flex min-h-16 items-center gap-3 rounded-xl border px-3.5 py-3 transition hover:shadow-survol ${e.valeur ? "border-amber-200 bg-amber-50/60 hover:border-amber-300" : "border-bordure bg-background hover:border-marque/30"}`}
            >
              <e.icone size={20} className={e.valeur ? "shrink-0 text-amber-700" : "shrink-0 text-doux"} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.libelle}</span>
                <span className="block truncate text-xs text-doux">{e.detail}</span>
              </span>
              <span className={`text-2xl font-bold tabular-nums ${e.valeur ? "text-amber-900" : "text-doux"}`}>{e.valeur}</span>
            </Link>
          </li>
        ))}
      </ul>
      {ailleurs > 0 && (
        <p className="border-t border-bordure px-4 py-3 text-sm text-doux sm:px-5">
          {ailleurs} autre{ailleurs > 1 ? "s" : ""} chose{ailleurs > 1 ? "s" : ""} vous attend{ailleurs > 1 ? "ent" : ""} dans vos autres entreprises (menu du compte, « Changer d&apos;entreprise »).
        </p>
      )}
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
  const [taches, courante, { data: salariesBruts }, { data: contrats }, { data: absencesBrutes }, { data: reclamations }, { data: echeancesBrutes }] =
    await Promise.all([
      mesTachesEntrepriseCourante(),
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
  const sansSalarie =
    salaries.length === 0 ? (
      <EtatVide
        icone={Users}
        titre="Aucun salarié pour l'instant"
        texte="Ajoutez vos premiers salariés pour voir apparaître les statistiques."
        action={
          <LienBouton href={`/espace/entreprises/${courante.id}/salaries/nouveau`} icone={UserPlus} taille="petit">
            Ajouter un salarié
          </LienBouton>
        }
      />
    ) : undefined;
  const donneesContrats = compter(contrats ?? [], (c) => c.type_contrat, TYPES_CONTRAT);
  const donneesReclamations = compter(reclamations ?? [], (r) => r.sujet, Object.fromEntries(Object.entries(SUJETS_RECLAMATION).map(([k, v]) => [k, v.libelle])));
  const lien = (chemin: string) => `/espace/entreprises/${courante.id}${chemin}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-bold tracking-tight">
          Tableau de bord <span className="font-semibold text-marque">· {courante.raison_sociale}</span>
        </h1>
        <p className="text-sm capitalize text-doux">{JOUR_LONG.format(maintenant)}</p>
      </header>

      <CarteAFaire
        paie={{
          aValider: taches.actions.filter((a) => a.action === "a_valider").length,
          aPublier: taches.actions.filter((a) => a.action === "a_publier").length,
          aCorriger: taches.actions.filter((a) => a.action === "a_corriger").length,
        }}
        demandes={taches.demandes.length}
        reclamations={taches.reclamations.length}
        ailleurs={taches.ailleurs.reduce((s, e) => s + e.nombre, 0)}
        lienPaie={lien("/paie")}
        lienAbsences={lien("/absences")}
        lienReclamations={lien("/reclamations")}
      />

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Indicateur icone={Users} libelle="Effectif" valeur={ceMois.effectif} detail="Salariés en poste aujourd'hui" teinte="indigo" href={lien("/salaries")} />
        <Indicateur icone={TrendingUp} libelle="Entrées du mois" valeur={ceMois.entrees} detail={`${effectif.reduce((s, m) => s + m.entrees, 0)} sur 12 mois`} teinte="vert" href="/espace/etats/entrees-sorties" />
        <Indicateur icone={TrendingDown} libelle="Sorties du mois" valeur={ceMois.sorties} detail={`${effectif.reduce((s, m) => s + m.sorties, 0)} sur 12 mois`} teinte="corail" href="/espace/etats/entrees-sorties" />
        <Indicateur icone={CalendarClock} libelle="Fins de CDD" valeur={finsCdd} detail={`Dans les 30 jours (et ${echeances.length - finsCdd} fin(s) d'essai)`} teinte="corail" href="/espace/etats/contrats" />
      </div>

      {/* Graphiques */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CarteGraphique titre="Évolution de l'effectif" sousTitre="12 derniers mois" vide={sansSalarie}>
          <GraphiqueEffectif donnees={effectif} />
        </CarteGraphique>
        <CarteGraphique titre="Pyramide des âges" sousTitre={pyramide.sansDate ? `${pyramide.sansDate} sans date de naissance ou sexe` : "salariés en poste"} vide={sansSalarie}>
          <GraphiquePyramide donnees={pyramide.tranches} />
        </CarteGraphique>
        <CarteGraphique
          titre="Contrats en cours"
          sousTitre="par type"
          vide={donneesContrats.length === 0 ? <EtatVide icone={FileSignature} titre="Aucun contrat en cours" texte="Les contrats apparaissent ici une fois créés." /> : undefined}
        >
          <GraphiqueAnneau donnees={donneesContrats} />
        </CarteGraphique>
        <CarteGraphique titre="Hommes et femmes" sousTitre="salariés en poste" vide={sansSalarie}>
          <GraphiqueAnneau donnees={repartitionSexe(salaries, maintenant)} />
        </CarteGraphique>
        <CarteGraphique
          titre="Absences du mois"
          sousTitre="jours par type"
          vide={absences.parType.length === 0 ? <EtatVide icone={CalendarDays} titre="Aucune absence ce mois-ci" texte="Les congés acceptés du mois s'afficheront ici." /> : undefined}
        >
          <GraphiqueBarresHorizontales donnees={absences.parType.map((a) => ({ nom: a.type, valeur: a.jours }))} unite=" j" />
        </CarteGraphique>
        <CarteGraphique
          titre="Réclamations ouvertes"
          sousTitre="par sujet"
          vide={donneesReclamations.length === 0 ? <EtatVide icone={CircleCheck} titre="Aucune réclamation ouverte" texte="Tout est traité." /> : undefined}
        >
          <GraphiqueBarresHorizontales donnees={donneesReclamations} />
        </CarteGraphique>
      </div>
    </div>
  );
}
