import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Briefcase, CircleCheck, Download, FileText, Inbox, MessageCircle } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/abonnements/phases";
import { libellePeriode } from "@/lib/bulletins/regles";
import { ActionEnLigne } from "@/components/formulaire";
import { Badge, Carte, EtatVide, Page } from "@/components/ui";
import { definirAccordWhatsApp } from "./actions";
import { utilisateurConnecte } from "@/lib/auth/connecte";

export const metadata: Metadata = { title: "Mes bulletins" };

type Emploi = {
  salarie_id: string;
  raison_sociale: string;
  matricule: string;
  nom: string;
  prenoms: string;
  poste: string | null;
  date_embauche: string;
  statut: string;
  date_sortie: string | null;
};
type Bulletin = { bulletin_id: string; salarie_id: string; raison_sociale: string; annee: number; mois: number; type: string; publie_le: string | null };

export default async function PageMesBulletins() {
  const supabase = await clientSupabaseServeur();
  const session = { user: await utilisateurConnecte(supabase) };
  if (!session.user) redirect("/portail/connexion");

  const [{ data: emplois }, { data: bulletins }, { data: emargements }, { data: accords }] = await Promise.all([
    supabase.rpc("mes_emplois"),
    supabase.rpc("mes_bulletins"),
    // La base ne renvoie que les émargements du salarié connecté
    supabase.from("emargements_bulletins").select("bulletin_id, emarge_le"),
    supabase.rpc("mon_accord_whatsapp"),
  ]);
  const recuLe = new Map((emargements ?? []).map((e) => [e.bulletin_id, e.emarge_le as string]));
  const accordWhatsApp = accords === true;
  const listeEmplois = (emplois ?? []) as Emploi[];
  const listeBulletins = (bulletins ?? []) as Bulletin[];
  const plusieursEmployeurs = new Set(listeEmplois.map((e) => e.raison_sociale)).size > 1;

  // Regroupement par année, la plus récente d'abord
  const parAnnee = new Map<number, Bulletin[]>();
  for (const b of listeBulletins) parAnnee.set(b.annee, [...(parAnnee.get(b.annee) ?? []), b]);

  const moi = listeEmplois[0];

  return (
    <Page>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{moi ? `Bonjour ${moi.prenoms}` : "Mon espace"}</h1>
        <p className="mt-1 text-doux">Vos bulletins de paie, disponibles à tout moment.</p>
      </header>

      {listeEmplois.length === 0 ? (
        <Carte>
          <EtatVide
            icone={Inbox}
            titre="Aucun dossier trouvé"
            texte="Votre numéro n'est plus associé à une fiche salarié, ou l'accès de votre employeur est suspendu. Contactez votre service RH."
          />
        </Carte>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {listeEmplois.map((e) => (
              <div key={e.salarie_id} className="flex items-start gap-3 rounded-xl border border-bordure bg-surface p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marque-claire text-marque">
                  <Briefcase size={18} aria-hidden />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{e.raison_sociale}</p>
                  <p className="text-doux">
                    {e.nom} {e.prenoms} · matricule {e.matricule}
                  </p>
                  {e.poste && <p className="text-doux">{e.poste}</p>}
                  <p className="text-doux">
                    Depuis le {formaterDate(e.date_embauche)}
                    {e.statut === "sorti" && e.date_sortie ? ` · sorti(e) le ${formaterDate(e.date_sortie)}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-marque/20 bg-marque-claire/60 px-4 py-3 text-sm text-marque-nuit">
            <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              <strong>Télécharger votre bulletin vaut accusé de réception</strong> (émargement électronique) : votre employeur voit la date à
              laquelle vous l&apos;avez reçu, comme une signature sur sa copie.
            </span>
          </p>

          {listeBulletins.length === 0 ? (
            <Carte>
              <EtatVide icone={FileText} titre="Aucun bulletin pour l'instant" texte="Vos bulletins apparaîtront ici dès que votre employeur les aura publiés." />
            </Carte>
          ) : (
            [...parAnnee].map(([annee, liste]) => (
              <Carte key={annee} titre={`Année ${annee}`} description={`${liste.length} bulletin${liste.length > 1 ? "s" : ""}`} sansMarge>
                <ul className="divide-y divide-bordure">
                  {liste.map((b) => (
                    <li key={b.bulletin_id}>
                      <a
                        href={`/portail/bulletins/${b.bulletin_id}`}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-black/[.02] sm:px-5"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marque-claire text-marque">
                          <FileText size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{libellePeriode(b.annee, b.mois)}</span>
                          <span className="block truncate text-sm text-doux">
                            {plusieursEmployeurs ? `${b.raison_sociale} · ` : ""}
                            {b.publie_le ? `Publié le ${formaterDate(b.publie_le)}` : "Publié"}
                            {recuLe.has(b.bulletin_id) ? ` · reçu le ${formaterDate(recuLe.get(b.bulletin_id)!)}` : ""}
                          </span>
                        </span>
                        {b.type === "rectificatif" && <Badge teinte="ambre">Rectificatif</Badge>}
                        <Download size={18} className="shrink-0 text-marque" aria-label="Télécharger" />
                      </a>
                    </li>
                  ))}
                </ul>
              </Carte>
            ))
          )}
          <Carte titre="Avis par WhatsApp" description="Recevez un message WhatsApp dès qu'un nouveau bulletin est disponible.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <MessageCircle size={18} className={accordWhatsApp ? "text-emerald-600" : "text-doux"} aria-hidden />
                {accordWhatsApp
                  ? "Vous recevez l'avis de vos bulletins par WhatsApp (le message contient seulement un lien vers cet espace)."
                  : "Vous ne recevez pas d'avis par WhatsApp."}
              </p>
              <ActionEnLigne
                action={definirAccordWhatsApp.bind(null, !accordWhatsApp)}
                libelle={accordWhatsApp ? "Ne plus recevoir" : "Recevoir les avis par WhatsApp"}
                variante={accordWhatsApp ? "discret" : "secondaire"}
              />
            </div>
          </Carte>
        </>
      )}
    </Page>
  );
}
