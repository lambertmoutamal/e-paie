import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Briefcase, ChevronDown, CircleCheck, Download, FileText, Inbox, MessageCircle } from "lucide-react";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/abonnements/phases";
import { libellePeriode } from "@/lib/bulletins/regles";
import { ActionEnLigne } from "@/components/formulaire";
import { Badge, Carte, EtatVide, Page } from "@/components/ui";
import { definirAccordWhatsApp } from "./actions";
import { BoutonInstallation } from "../application";
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

  // Dernier bulletin : période la plus récente (puis date de publication)
  const dernier = [...listeBulletins].sort((a, b) => b.annee * 100 + b.mois - (a.annee * 100 + a.mois) || (b.publie_le ?? "").localeCompare(a.publie_le ?? ""))[0];

  return (
    <Page>
      <BoutonInstallation />
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
          {dernier && (
            <section aria-labelledby="dernier-bulletin" className="overflow-hidden rounded-2xl bg-gradient-to-br from-marque-nuit via-marque-fonce to-marque p-5 text-white shadow-flottant">
              <p id="dernier-bulletin" className="flex items-center gap-2 text-sm font-semibold text-white/90">
                <FileText size={16} aria-hidden />
                Votre dernier bulletin
                {!recuLe.has(dernier.bulletin_id) && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-marque-nuit">Nouveau</span>}
              </p>
              <p className="mt-1 text-2xl font-bold capitalize tracking-tight">{libellePeriode(dernier.annee, dernier.mois)}</p>
              <p className="text-sm text-white/85">
                {plusieursEmployeurs ? `${dernier.raison_sociale} · ` : ""}
                {dernier.publie_le ? `Publié le ${formaterDate(dernier.publie_le)}` : "Publié"}
                {dernier.type === "rectificatif" ? " · rectificatif" : ""}
              </p>
              <a
                href={`/portail/bulletins/${dernier.bulletin_id}`}
                target="_blank"
                rel="noopener"
                className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-bold text-marque-nuit shadow-sm transition-colors hover:bg-marque-claire focus-visible:outline-white"
              >
                <Download size={20} aria-hidden />
                Télécharger mon bulletin de {libellePeriode(dernier.annee, dernier.mois)}
              </a>
              <p className="mt-3 text-center text-xs text-white/85">Le télécharger confirme à votre employeur que vous l&apos;avez reçu.</p>
            </section>
          )}

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
                        className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-marque-claire/50 sm:px-5"
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
                        {!recuLe.has(b.bulletin_id) && <Badge teinte="vert">Nouveau</Badge>}
                        {b.type === "rectificatif" && <Badge teinte="ambre">Rectificatif</Badge>}
                        <Download size={18} className="shrink-0 text-marque" aria-hidden />
                        <span className="sr-only">Télécharger</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Carte>
            ))
          )}
          <details className="group rounded-2xl border border-bordure bg-surface shadow-carte">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold sm:px-5">
              <span className="flex items-center gap-2">
                <Briefcase size={18} className="text-marque" aria-hidden />
                Mes informations d&apos;emploi et mon accusé de réception
              </span>
              <ChevronDown size={18} className="shrink-0 text-doux transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="flex flex-col gap-4 border-t border-bordure p-4 sm:p-5">
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
            </div>
          </details>

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
