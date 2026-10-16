import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { libellePeriode } from "@/lib/bulletins/regles";
import { SUJETS_RECLAMATION } from "@/lib/reclamations/regles";
import { Champ, ChampFichier, ChoixListe, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Carte, Page } from "@/components/ui";
import { ouvrirReclamation } from "../actions";
import { utilisateurConnecte } from "@/lib/auth/connecte";

export const metadata: Metadata = { title: "Nouvelle réclamation" };

type Emploi = { salarie_id: string; entreprise_id: string; raison_sociale: string };
type Bulletin = { bulletin_id: string; salarie_id: string; annee: number; mois: number };

export default async function PageNouvelleReclamation({ searchParams }: PageProps<"/portail/reclamations/nouvelle">) {
  const { emploi: choisi } = await searchParams;
  const supabase = await clientSupabaseServeur();
  const session = { user: await utilisateurConnecte(supabase) };
  if (!session.user) redirect("/portail/connexion");

  const [{ data: emplois }, { data: bulletins }] = await Promise.all([supabase.rpc("mes_emplois"), supabase.rpc("mes_bulletins")]);
  const liste = (emplois ?? []) as Emploi[];
  if (!liste.length) redirect("/portail/reclamations");
  const emploi = liste.find((e) => e.salarie_id === choisi) ?? liste[0];
  const sesBulletins = ((bulletins ?? []) as Bulletin[]).filter((b) => b.salarie_id === emploi.salarie_id);

  return (
    <Page>
      <Link href="/portail/reclamations" className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline">
        <ChevronLeft size={16} aria-hidden />
        Mes réclamations
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Nouvelle réclamation</h1>

      {liste.length > 1 && (
        <nav aria-label="Employeur" className="flex flex-wrap gap-2">
          {liste.map((e) => (
            <Link
              key={e.salarie_id}
              href={`?emploi=${e.salarie_id}`}
              aria-current={e.salarie_id === emploi.salarie_id ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${e.salarie_id === emploi.salarie_id ? "border-marque bg-marque-claire text-marque" : "border-bordure text-doux"}`}
            >
              {e.raison_sociale}
            </Link>
          ))}
        </nav>
      )}

      <Carte>
        <Formulaire action={ouvrirReclamation.bind(null, emploi.salarie_id, emploi.entreprise_id)} libelleBouton="Envoyer" colonnes={2}>
          <ChoixListe
            nom="sujet"
            libelle="Sujet"
            requis
            options={Object.entries(SUJETS_RECLAMATION).map(([valeur, s]) => ({ valeur, libelle: s.libelle }))}
          />
          <ChoixListe
            nom="bulletin_id"
            libelle="Bulletin concerné (facultatif)"
            valeurInitiale="aucun"
            options={[{ valeur: "aucun", libelle: "Aucun" }, ...sesBulletins.map((b) => ({ valeur: b.bulletin_id, libelle: libellePeriode(b.annee, b.mois) }))]}
          />
          <Champ nom="objet" libelle="En quelques mots" requis pleineLargeur aide="Exemple : prime de transport absente" />
          <ZoneTexte nom="message" libelle="Votre message" max={3000} />
          <ChampFichier libelle="Pièce jointe (facultatif)" aide="Photo ou PDF, 4 Mo maximum." />
        </Formulaire>
      </Carte>
      <p className="text-sm text-doux">
        Votre réclamation est transmise directement à la bonne personne : le gestionnaire de paie pour un bulletin, le service RH pour le reste.
        Vous serez prévenu de la réponse.
      </p>
    </Page>
  );
}
