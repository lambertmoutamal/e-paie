import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarOff,
  Cake,
  FileCheck2,
  Inbox,
  MessagesSquare,
  PartyPopper,
  Plus,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { champLie, valeurLiee } from "@/lib/supabase/relations";
import { libelleDates } from "@/lib/absences/regles";
import { libellePeriode, salariesAttendus } from "@/lib/bulletins/regles";
import { TYPES_CONTRAT } from "@/lib/contrats/regles";
import { SUJETS_RECLAMATION } from "@/lib/reclamations/regles";
import { entrepriseCourante, entreprisesAccessibles } from "@/lib/entreprise-courante";
import { absencesDuMois, compter, evolutionEffectif, repartitionSexe, type AbsenceStat, type SalarieStat } from "@/lib/tableau-de-bord/calculs";
import { CarteEcheances, type Echeance } from "@/components/echeances";
import { CarteActionsPaie } from "@/components/actions-paie";
import { Avatar } from "@/components/avatar";
import { GraphiqueAnneau, GraphiqueBarresHorizontales, GraphiqueEffectif, GraphiqueMouvements } from "@/components/graphiques-dynamiques";
import { mesActionsPaie, mesDemandesATraiter, mesReclamationsATraiter } from "@/lib/bulletins/actions-a-faire";
import { Carte, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

const JOUR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Libreville" });
const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

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
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-doux">{libelle}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${TEINTES[teinte]}`}>
          <Icone size={18} aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{valeur}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-doux">{detail}</p>}
    </>
  );
  const classes = "rounded-2xl border border-bordure bg-surface p-4 shadow-[0_1px_3px_rgba(27,30,46,.05)]";
  return href ? (
    <Link href={href} className={`${classes} block transition hover:-translate-y-0.5 hover:shadow-md`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

type SalarieMini = SalarieStat & { id: string; entreprise_id: string; nom: string; prenoms: string; date_naissance: string | null };

function evenements(salaries: SalarieMini[], aujourdhui: Date) {
  const limite = new Date(aujourdhui.getTime() + 30 * 86_400_000);
  const minuit = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()));
  const prochaine = (iso: string) => {
    const [a, m, j] = iso.split("-").map(Number);
    let d = new Date(Date.UTC(minuit.getUTCFullYear(), m - 1, j));
    if (d < minuit) d = new Date(Date.UTC(minuit.getUTCFullYear() + 1, m - 1, j));
    return { d, annees: d.getUTCFullYear() - a };
  };
  const liste: { s: SalarieMini; date: Date; type: "anniversaire" | "anciennete"; annees: number }[] = [];
  for (const s of salaries) {
    if (s.statut !== "actif") continue;
    if (s.date_naissance) {
      const { d } = prochaine(s.date_naissance);
      if (d <= limite) liste.push({ s, date: d, type: "anniversaire", annees: 0 });
    }
    const { d, annees } = prochaine(s.date_embauche);
    if (annees >= 1 && d <= limite) liste.push({ s, date: d, type: "anciennete", annees });
  }
  return liste.sort((x, y) => x.date.getTime() - y.date.getTime()).slice(0, 6);
}

export default async function TableauDeBord() {
  const { supabase } = await exigerUtilisateur();
  const [{ adminPlateforme, cabinets }, courante, accessibles] = await Promise.all([droitsUtilisateur(), entrepriseCourante(), entreprisesAccessibles()]);
  const administrateur = adminPlateforme || cabinets.length > 0;
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const debutMois = `${aujourdhui.slice(0, 8)}01`;
  // Entreprise choisie dans la barre du haut, sinon toutes celles accessibles
  const perimetre = courante ? [courante.id] : accessibles.map((e) => e.id);

  // Toutes les lectures sont limitées par la base au périmètre de la personne
  const [
    { data: salariesBruts },
    { data: contrats },
    { data: absencesBrutes },
    { data: absentsAujourdhui },
    { count: demandesAttente },
    { data: reclamations },
    { data: periodes },
    { data: echeancesBrutes },
    actionsPaie,
    demandesATraiter,
    reclamationsATraiter,
  ] = await Promise.all([
    supabase.from("salaries").select("id, entreprise_id, nom, prenoms, sexe, date_naissance, date_embauche, date_sortie, statut").in("entreprise_id", perimetre).limit(5000),
    supabase.from("contrats").select("type_contrat").eq("statut", "en_cours").neq("nature", "avenant").in("entreprise_id", perimetre).limit(5000),
    supabase.from("demandes_absence").select("debut, fin, nb_jours, types_absence(libelle)").eq("statut", "acceptee").lte("debut", aujourdhui.slice(0, 8) + "31").gte("fin", debutMois).in("entreprise_id", perimetre).limit(5000),
    supabase.from("demandes_absence").select("id, debut, fin, salaries(nom, prenoms), types_absence(libelle)").eq("statut", "acceptee").lte("debut", aujourdhui).gte("fin", aujourdhui).in("entreprise_id", perimetre).limit(8),
    supabase.from("demandes_absence").select("id", { count: "exact", head: true }).eq("statut", "en_attente").in("entreprise_id", perimetre),
    supabase.from("reclamations").select("sujet").in("statut", ["ouverte", "en_cours"]).in("entreprise_id", perimetre).limit(2000),
    supabase.from("periodes_paie").select("id, entreprise_id, annee, mois, statut, bulletins(count)").order("annee", { ascending: false }).order("mois", { ascending: false }).in("entreprise_id", perimetre).limit(courante ? 1 : 50),
    supabase.rpc("echeances_contrats", { p_jours: 30 }),
    mesActionsPaie(),
    mesDemandesATraiter(),
    mesReclamationsATraiter(),
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
  const echeances = ((echeancesBrutes ?? []) as Echeance[]).filter((e) => !courante || e.entreprise_id === courante.id);
  const finsCdd = echeances.filter((e) => e.nature === "fin_contrat").length;
  const nbActions = actionsPaie.length + demandesATraiter.length + reclamationsATraiter.length;

  // Dernière période de paie : bulletins déposés / attendus
  const derniere = periodes?.[0];
  const nbBulletins = derniere ? ((derniere.bulletins as unknown as { count: number }[])[0]?.count ?? 0) : 0;
  const attendus = derniere ? salariesAttendus(salaries.filter((s) => s.entreprise_id === derniere.entreprise_id).map((s) => ({ ...s, matricule: "" })), derniere.annee, derniere.mois).length : 0;

  const contratsParType = compter(contrats ?? [], (c) => c.type_contrat, TYPES_CONTRAT);
  const reclamationsParSujet = compter(reclamations ?? [], (r) => r.sujet, Object.fromEntries(Object.entries(SUJETS_RECLAMATION).map(([k, v]) => [k, v.libelle])));
  const aVenir = evenements(salaries, maintenant);

  return (
    <Page>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm capitalize text-doux">{JOUR_LONG.format(maintenant)}</p>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-doux">
            {courante ? (
              <>
                Entreprise : <strong className="text-foreground">{courante.raison_sociale}</strong>
              </>
            ) : (
              "Toutes vos entreprises — choisissez-en une dans la barre du haut pour cibler les chiffres."
            )}
          </p>
        </div>
        {administrateur && (
          <Link href="/espace/entreprises/nouvelle" className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-marque px-4 text-sm font-semibold text-white shadow-sm hover:bg-marque-fonce sm:self-auto">
            <Plus size={16} aria-hidden />
            Nouvelle entreprise
          </Link>
        )}
      </header>

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur icone={Users} libelle="Effectif" valeur={ceMois.effectif} detail="salariés en poste aujourd'hui" teinte="indigo" />
        <Indicateur icone={TrendingUp} libelle="Entrées du mois" valeur={ceMois.entrees} detail={`${effectif.reduce((s, m) => s + m.entrees, 0)} sur 12 mois`} teinte="vert" />
        <Indicateur icone={TrendingDown} libelle="Sorties du mois" valeur={ceMois.sorties} detail={`${effectif.reduce((s, m) => s + m.sorties, 0)} sur 12 mois`} teinte="corail" />
        <Indicateur icone={CalendarOff} libelle="Taux d'absentéisme" valeur={`${absences.tauxAbsenteisme.toLocaleString("fr-FR")} %`} detail={`${absences.totalJours.toLocaleString("fr-FR")} jours d'absence ce mois`} teinte="ciel" />
        <Indicateur
          icone={FileCheck2}
          libelle="Bulletins de la dernière paie"
          valeur={derniere ? `${nbBulletins} / ${attendus}` : "—"}
          detail={derniere ? `${libellePeriode(derniere.annee, derniere.mois)}${courante ? "" : " (dernière période)"}` : "Aucune période de paie"}
          teinte="violet"
          href={courante ? `/espace/entreprises/${courante.id}/paie` : undefined}
        />
        <Indicateur icone={Inbox} libelle="Demandes d'absence en attente" valeur={demandesAttente ?? 0} teinte="ambre" href={courante ? `/espace/entreprises/${courante.id}/absences` : undefined} />
        <Indicateur icone={MessagesSquare} libelle="Réclamations ouvertes" valeur={reclamations?.length ?? 0} teinte="rose" href={courante ? `/espace/entreprises/${courante.id}/reclamations` : undefined} />
        <Indicateur icone={CalendarClock} libelle="Fins de CDD sous 30 jours" valeur={finsCdd} detail={`${echeances.length - finsCdd} fin(s) de période d'essai`} teinte="corail" href="/espace/etats/contrats" />
      </div>

      {nbActions > 0 && <CarteActionsPaie actions={actionsPaie} demandes={demandesATraiter} reclamations={reclamationsATraiter} />}

      {/* Graphiques */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="Évolution de l'effectif" description="12 derniers mois">
          <GraphiqueEffectif donnees={effectif} />
        </Carte>
        <Carte titre="Entrées et sorties" description="12 derniers mois">
          <GraphiqueMouvements donnees={effectif} />
        </Carte>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Carte titre="Contrats en cours" description="Par type de contrat">
          <GraphiqueAnneau donnees={contratsParType} />
        </Carte>
        <Carte titre="Hommes et femmes" description="Salariés en poste">
          <GraphiqueAnneau donnees={repartitionSexe(salaries, maintenant)} />
        </Carte>
        <Carte titre="Absences du mois" description="Jours d'absence par type">
          <GraphiqueBarresHorizontales donnees={absences.parType.map((a) => ({ nom: a.type, valeur: a.jours }))} unite=" j" />
        </Carte>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Carte titre="Réclamations ouvertes" description="Par sujet">
          <GraphiqueBarresHorizontales donnees={reclamationsParSujet} />
        </Carte>
        <Carte titre="Qui est absent aujourd'hui" sansMarge>
          {!absentsAujourdhui?.length ? (
            <p className="px-4 py-5 text-sm text-doux sm:px-5">Toute l&apos;équipe est présente.</p>
          ) : (
            <ul className="divide-y divide-bordure">
              {absentsAujourdhui.map((a) => {
                const nom = `${valeurLiee(a.salaries, "prenoms") ?? ""} ${valeurLiee(a.salaries, "nom") ?? ""}`.trim();
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <Avatar nom={nom} taille="petit" />
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{nom}</p>
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
        <Carte titre="Anniversaires et ancienneté" description="30 prochains jours" sansMarge>
          {!aVenir.length ? (
            <p className="px-4 py-5 text-sm text-doux sm:px-5">Aucun événement à venir.</p>
          ) : (
            <ul className="divide-y divide-bordure">
              {aVenir.map((e) => (
                <li key={`${e.s.id}-${e.type}`}>
                  <Link href={`/espace/entreprises/${e.s.entreprise_id}/salaries/${e.s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[.02] sm:px-5">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${e.type === "anniversaire" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                      {e.type === "anniversaire" ? <Cake size={17} aria-hidden /> : <PartyPopper size={17} aria-hidden />}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">
                        {e.s.prenoms} {e.s.nom}
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
      </div>

      {echeances.length > 0 && <CarteEcheances echeances={echeances.slice(0, 8)} avecEntreprise={!courante} />}

      {nbActions === 0 && (
        <p className="flex items-center justify-center gap-2 text-sm text-doux">
          <UserCheck size={16} className="text-emerald-600" aria-hidden />
          Aucune validation, demande ou réclamation ne vous attend.
        </p>
      )}
    </Page>
  );
}
