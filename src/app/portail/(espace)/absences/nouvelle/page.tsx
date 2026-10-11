import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { formaterJours } from "@/lib/absences/regles";
import { CaseACocher, Champ, ChampFichier, ChoixListe, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Carte, Page } from "@/components/ui";
import { demanderAbsence } from "../actions";

export const metadata: Metadata = { title: "Nouvelle demande" };

type Emploi = { salarie_id: string; entreprise_id: string; raison_sociale: string; statut: string };
type TypeAbsence = { id: string; libelle: string; jours_max: number | null; justificatif_requis: boolean; deduit_solde: boolean };

export default async function PageNouvelleDemande({ searchParams }: PageProps<"/portail/absences/nouvelle">) {
  const { emploi: choisi } = await searchParams;
  const supabase = await clientSupabaseServeur();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) redirect("/portail/connexion");

  const { data: emplois } = await supabase.rpc("mes_emplois");
  const actifs = ((emplois ?? []) as Emploi[]).filter((e) => e.statut === "actif");
  if (!actifs.length) redirect("/portail/absences");
  const emploi = actifs.find((e) => e.salarie_id === choisi) ?? actifs[0];
  const { data: typesBruts } = await supabase.rpc("mes_types_absence", { p_salarie_id: emploi.salarie_id });
  const types = (typesBruts ?? []) as TypeAbsence[];
  const demain = new Date();
  demain.setUTCDate(demain.getUTCDate() + 1);

  return (
    <Page>
      <Link href="/portail/absences" className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline">
        <ChevronLeft size={16} aria-hidden />
        Mes absences
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Nouvelle demande</h1>

      {actifs.length > 1 && (
        <nav aria-label="Employeur" className="flex flex-wrap gap-2">
          {actifs.map((e) => (
            <Link
              key={e.salarie_id}
              href={`?emploi=${e.salarie_id}`}
              aria-current={e.salarie_id === emploi.salarie_id ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                e.salarie_id === emploi.salarie_id ? "border-marque bg-marque-claire text-marque" : "border-bordure text-doux"
              }`}
            >
              {e.raison_sociale}
            </Link>
          ))}
        </nav>
      )}

      <Carte>
        <Formulaire action={demanderAbsence.bind(null, emploi.salarie_id, emploi.entreprise_id)} libelleBouton="Envoyer la demande" colonnes={2}>
          <ChoixListe
            nom="type_id"
            libelle="Type d'absence"
            requis
            pleineLargeur
            options={types.map((t) => ({
              valeur: t.id,
              libelle: `${t.libelle}${t.jours_max ? ` (${formaterJours(t.jours_max)} max)` : ""}${t.justificatif_requis ? " — justificatif demandé" : ""}`,
            }))}
          />
          <Champ nom="debut" libelle="Du" type="date" requis valeurInitiale={demain.toISOString().slice(0, 10)} />
          <Champ nom="fin" libelle="Au" type="date" requis valeurInitiale={demain.toISOString().slice(0, 10)} />
          <CaseACocher nom="debut_apres_midi">Je commence l&apos;après-midi du premier jour</CaseACocher>
          <CaseACocher nom="fin_midi">Je reviens l&apos;après-midi du dernier jour</CaseACocher>
          <ZoneTexte nom="motif" libelle="Message pour le RH (facultatif)" max={500} />
          <ChampFichier libelle="Justificatif" aide="Obligatoire pour certaines permissions (acte de mariage, certificat…). PDF ou photo, 5 Mo maximum." />
        </Formulaire>
      </Carte>
      <p className="text-sm text-doux">Les week-ends et jours fériés ne sont pas décomptés. Vous serez prévenu dès que le RH aura répondu.</p>
    </Page>
  );
}
