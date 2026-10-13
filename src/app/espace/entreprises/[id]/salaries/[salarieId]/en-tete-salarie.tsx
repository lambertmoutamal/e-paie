import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronRight, Mail, Phone, Hash } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { Avatar } from "@/components/avatar";

type Onglet = "fiche" | "contrats" | "documents";

// En-tête du dossier salarié : bandeau coloré, avatar, coordonnées et onglets
// (présentation inspirée des SIRH du marché).
export function EnTeteSalarie({
  entrepriseId,
  raisonSociale,
  salarie,
  onglet,
}: {
  entrepriseId: string;
  raisonSociale: string;
  salarie: {
    id: string;
    nom: string;
    prenoms: string;
    matricule: string;
    poste: string | null;
    statut: string;
    date_sortie: string | null;
    date_embauche: string;
    telephone?: string | null;
    email?: string | null;
  };
  onglet: Onglet;
}) {
  const base = `/espace/entreprises/${entrepriseId}/salaries/${salarie.id}`;
  const aVenir = salarie.statut === "actif" && salarie.date_embauche > new Date().toISOString().slice(0, 10);
  const onglets: { cle: Onglet; libelle: string; href: string }[] = [
    { cle: "fiche", libelle: "Fiche", href: base },
    { cle: "contrats", libelle: "Contrats", href: `${base}/contrats` },
    { cle: "documents", libelle: "Documents", href: `${base}/documents` },
  ];
  const statut =
    salarie.statut === "sorti"
      ? { texte: `Sorti(e) le ${formaterDate(salarie.date_sortie!)}`, classes: "bg-white/15 text-white" }
      : aVenir
        ? { texte: `Arrive le ${formaterDate(salarie.date_embauche)}`, classes: "bg-sky-400/90 text-white" }
        : { texte: "En poste", classes: "bg-emerald-400/90 text-white" };

  return (
    <div className="overflow-hidden rounded-3xl border border-bordure bg-surface shadow-sm">
      <div className="relative bg-gradient-to-br from-marque-nuit via-marque-fonce to-marque px-5 pb-5 pt-4 text-white sm:px-8">
        <span aria-hidden className="absolute -right-12 -top-12 size-48 rounded-full bg-accent/30 blur-2xl" />
        <nav aria-label="Fil d'Ariane" className="relative mb-4 flex flex-wrap items-center gap-1 text-sm text-white/75">
          <Link href={`/espace/entreprises/${entrepriseId}`} className="hover:text-white">
            {raisonSociale}
          </Link>
          <ChevronRight size={14} aria-hidden />
          <Link href={`/espace/entreprises/${entrepriseId}/salaries`} className="hover:text-white">
            Salariés
          </Link>
        </nav>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar nom={`${salarie.prenoms} ${salarie.nom}`} taille="grand" contour />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {salarie.prenoms} {salarie.nom}
              </h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statut.classes}`}>
                <BadgeCheck size={13} aria-hidden />
                {statut.texte}
              </span>
            </div>
            <p className="mt-0.5 text-white/85">{salarie.poste ?? "Poste non renseigné"}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/85">
              <li className="inline-flex items-center gap-1.5">
                <Hash size={14} aria-hidden />
                {salarie.matricule}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                Depuis le {formaterDate(salarie.date_embauche)}
              </li>
              {salarie.telephone && (
                <li>
                  <a href={`tel:${salarie.telephone}`} className="inline-flex items-center gap-1.5 hover:text-white hover:underline">
                    <Phone size={14} aria-hidden />
                    {salarie.telephone}
                  </a>
                </li>
              )}
              {salarie.email && (
                <li>
                  <a href={`mailto:${salarie.email}`} className="inline-flex items-center gap-1.5 hover:text-white hover:underline">
                    <Mail size={14} aria-hidden />
                    {salarie.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <nav aria-label="Dossier du salarié" className="flex gap-1 overflow-x-auto px-3 sm:px-6">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={o.href}
            aria-current={o.cle === onglet ? "page" : undefined}
            className={`shrink-0 border-b-[3px] px-4 py-3 text-sm font-semibold transition ${
              o.cle === onglet ? "border-accent text-marque-fonce" : "border-transparent text-doux hover:text-foreground"
            }`}
          >
            {o.libelle}
          </Link>
        ))}
      </nav>
    </div>
  );
}
