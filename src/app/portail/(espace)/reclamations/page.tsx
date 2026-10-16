import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessageSquarePlus, MessagesSquare } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/abonnements/phases";
import { STATUTS_RECLAMATION, SUJETS_RECLAMATION, type StatutReclamation, type SujetReclamation } from "@/lib/reclamations/regles";
import { Badge, Carte, classesBouton, EtatVide, Page } from "@/components/ui";
import { utilisateurConnecte } from "@/lib/auth/connecte";

export const metadata: Metadata = { title: "Mes réclamations" };

type Reclamation = { id: string; raison_sociale: string; sujet: SujetReclamation; objet: string; statut: StatutReclamation; derniere_activite: string; attente_personnel: boolean };

export default async function PageMesReclamations() {
  const supabase = await clientSupabaseServeur();
  const session = { user: await utilisateurConnecte(supabase) };
  if (!session.user) redirect("/portail/connexion");
  const [{ data }, { data: emplois }] = await Promise.all([supabase.rpc("mes_reclamations"), supabase.rpc("mes_emplois")]);
  const liste = (data ?? []) as Reclamation[];
  const plusieurs = new Set(((emplois ?? []) as { raison_sociale: string }[]).map((e) => e.raison_sociale)).size > 1;

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes réclamations</h1>
          <p className="mt-1 text-doux">Une question sur votre bulletin, vos congés, un document ? Écrivez-nous ici.</p>
        </div>
        {(emplois ?? []).length > 0 && (
          <Link href="/portail/reclamations/nouvelle" className={`${classesBouton()} h-12`}>
            <MessageSquarePlus size={18} aria-hidden />
            Nouvelle réclamation
          </Link>
        )}
      </header>

      <Carte sansMarge>
        {liste.length === 0 ? (
          <EtatVide icone={MessagesSquare} titre="Aucune réclamation" texte="Vos échanges avec votre employeur apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-bordure">
            {liste.map((r) => {
              const statut = STATUTS_RECLAMATION[r.statut];
              const reponseRecue = !r.attente_personnel && (r.statut === "en_cours" || r.statut === "resolue");
              return (
                <li key={r.id}>
                  <Link href={`/portail/reclamations/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[.02] sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.objet}</span>
                      <span className="block truncate text-sm text-doux">
                        {SUJETS_RECLAMATION[r.sujet].libelle}
                        {plusieurs ? ` · ${r.raison_sociale}` : ""} · {formaterDate(r.derniere_activite)}
                      </span>
                    </span>
                    {reponseRecue && <Badge teinte="vert">Réponse reçue</Badge>}
                    <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
                    <ChevronRight size={18} className="shrink-0 text-doux" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </Page>
  );
}
