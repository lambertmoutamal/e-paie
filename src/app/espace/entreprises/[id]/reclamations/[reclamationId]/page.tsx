import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { libellePeriode } from "@/lib/bulletins/regles";
import { valeurLiee } from "@/lib/supabase/relations";
import { STATUTS_RECLAMATION, SUJETS_RECLAMATION, type StatutReclamation, type SujetReclamation } from "@/lib/reclamations/regles";
import { FilReclamation, type MessageFil } from "@/components/fil-reclamation";
import { CaseACocher, ChampFichier, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, Page } from "@/components/ui";
import { repondreReclamation } from "../actions";

export const metadata: Metadata = { title: "Réclamation" };

const lienPiece = (chemin: string) => `/espace/fichiers?espace=reclamations&chemin=${encodeURIComponent(chemin)}`;

export default async function PageReclamation({ params }: PageProps<"/espace/entreprises/[id]/reclamations/[reclamationId]">) {
  const { id, reclamationId } = await params;
  const { supabase } = await exigerUtilisateur();

  const [{ data: entreprise }, { data: r }, { data: messages }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase
      .from("reclamations")
      .select("id, salarie_id, sujet, objet, statut, cree_le, bulletin_id, salaries(nom, prenoms, matricule), bulletins(fichier_chemin, periodes_paie(annee, mois))")
      .eq("id", reclamationId)
      .eq("entreprise_id", id)
      .maybeSingle(),
    supabase
      .from("messages_reclamation")
      .select("id, de_salarie, contenu, piece_chemin, piece_nom, cree_le, profils(nom_complet)")
      .eq("reclamation_id", reclamationId)
      .order("cree_le"),
  ]);
  if (!entreprise || !r) notFound();
  const { data: peutRepondre } = await supabase.rpc("peut_traiter_reclamation", { p_entreprise_id: id, p_sujet: r.sujet });

  const salarie = `${valeurLiee(r.salaries, "nom") ?? ""} ${valeurLiee(r.salaries, "prenoms") ?? ""}`.trim();
  const fil: MessageFil[] = (messages ?? []).map((m) => ({
    id: m.id,
    de_salarie: m.de_salarie,
    auteur: m.de_salarie ? salarie : (valeurLiee(m.profils, "nom_complet") ?? "Équipe"),
    contenu: m.contenu,
    piece_chemin: m.piece_chemin,
    piece_nom: m.piece_nom,
    cree_le: m.cree_le,
  }));
  const bulletin = (Array.isArray(r.bulletins) ? r.bulletins[0] : r.bulletins) as { fichier_chemin: string; periodes_paie: { annee: number; mois: number } | { annee: number; mois: number }[] } | null;
  const periode = bulletin ? (Array.isArray(bulletin.periodes_paie) ? bulletin.periodes_paie[0] : bulletin.periodes_paie) : null;
  const statut = STATUTS_RECLAMATION[r.statut as StatutReclamation];
  const sujet = SUJETS_RECLAMATION[r.sujet as SujetReclamation];

  return (
    <Page>
      <EnTetePage
        titre={r.objet}
        description={`${salarie} · matricule ${valeurLiee(r.salaries, "matricule") ?? "—"} · ${sujet.libelle} · ouverte le ${formaterDate(r.cree_le)}`}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/reclamations`, libelle: "Réclamations" },
        ]}
        actions={<Badge teinte={statut.teinte}>{statut.libelle}</Badge>}
      />

      {bulletin && periode && (
        <p className="flex items-center gap-2 text-sm">
          <FileText size={16} className="text-marque" aria-hidden />
          Bulletin concerné :{" "}
          <Link href={`/espace/fichiers?espace=bulletins&chemin=${encodeURIComponent(bulletin.fichier_chemin)}`} target="_blank" className="font-medium text-marque hover:underline">
            {libellePeriode(periode.annee, periode.mois)}
          </Link>
        </p>
      )}

      <FilReclamation messages={fil} cote="personnel" lienPiece={lienPiece} />

      {r.statut === "fermee" ? (
        <p className="text-center text-sm text-doux">Le salarié a confirmé que le problème est réglé : réclamation close.</p>
      ) : peutRepondre === true ? (
        <Carte titre="Répondre au salarié">
          <Formulaire action={repondreReclamation.bind(null, id, r.salarie_id, r.id)} libelleBouton="Envoyer la réponse">
            <ZoneTexte nom="contenu" libelle="Votre réponse" max={3000} />
            <ChampFichier libelle="Pièce jointe (facultatif)" aide="Exemple : bulletin corrigé, attestation. PDF ou image, 5 Mo maximum." />
            <CaseACocher nom="resoudre">Le problème est réglé : marquer la réclamation comme résolue</CaseACocher>
          </Formulaire>
        </Carte>
      ) : null}
    </Page>
  );
}
