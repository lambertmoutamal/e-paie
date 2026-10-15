import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, ChevronLeft } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { STATUTS_RECLAMATION, SUJETS_RECLAMATION, type StatutReclamation, type SujetReclamation } from "@/lib/reclamations/regles";
import { FilReclamation, type MessageFil } from "@/components/fil-reclamation";
import { ChampFichier, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Badge, Carte, classesBouton, Page } from "@/components/ui";
import { cloturerReclamation, repondreReclamation } from "../actions";
import { utilisateurConnecte } from "@/lib/auth/connecte";

export const metadata: Metadata = { title: "Réclamation" };

type Reclamation = { id: string; salarie_id: string; raison_sociale: string; sujet: SujetReclamation; objet: string; statut: StatutReclamation };

export default async function PageReclamation({ params }: PageProps<"/portail/reclamations/[id]">) {
  const { id } = await params;
  const supabase = await clientSupabaseServeur();
  const session = { user: await utilisateurConnecte(supabase) };
  if (!session.user) redirect("/portail/connexion");

  const [{ data: liste }, { data: messages }, { data: emplois }] = await Promise.all([
    supabase.rpc("mes_reclamations"),
    supabase.rpc("messages_de_ma_reclamation", { p_reclamation_id: id }),
    supabase.rpc("mes_emplois"),
  ]);
  const r = ((liste ?? []) as Reclamation[]).find((x) => x.id === id);
  if (!r) notFound();
  const emploi = ((emplois ?? []) as { salarie_id: string; entreprise_id: string }[]).find((e) => e.salarie_id === r.salarie_id);
  const statut = STATUTS_RECLAMATION[r.statut];

  return (
    <Page>
      <Link href="/portail/reclamations" className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline">
        <ChevronLeft size={16} aria-hidden />
        Mes réclamations
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{r.objet}</h1>
          <p className="text-sm text-doux">
            {SUJETS_RECLAMATION[r.sujet].libelle} · {r.raison_sociale} · traitée par {SUJETS_RECLAMATION[r.sujet].traite_par}
          </p>
        </div>
        <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
      </header>

      <FilReclamation messages={(messages ?? []) as MessageFil[]} cote="salarie" lienPiece={(c) => `/portail/reclamations/piece?chemin=${encodeURIComponent(c)}`} />

      {r.statut === "resolue" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-marque/30 bg-marque-claire/60 px-4 py-3 text-sm">
          <span>Votre employeur indique que le problème est réglé. Est-ce bien le cas ?</span>
          <form action={cloturerReclamation.bind(null, r.id)}>
            <button type="submit" className={classesBouton("principal", "petit")}>
              <CircleCheck size={14} aria-hidden />
              Oui, c&apos;est réglé
            </button>
          </form>
        </div>
      )}

      {r.statut !== "fermee" && emploi ? (
        <Carte titre={r.statut === "resolue" ? "Le problème persiste ? Répondez" : "Répondre"}>
          <Formulaire action={repondreReclamation.bind(null, r.id, r.salarie_id, emploi.entreprise_id)} libelleBouton="Envoyer">
            <ZoneTexte nom="contenu" libelle="Votre message" max={3000} />
            <ChampFichier libelle="Pièce jointe (facultatif)" aide="Photo ou PDF, 5 Mo maximum." />
          </Formulaire>
        </Carte>
      ) : (
        <p className="text-center text-sm text-doux">Réclamation close.</p>
      )}
    </Page>
  );
}
