import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogOut, MessageCircle, RotateCcw } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { ActionEnLigne, Champ, Formulaire } from "@/components/formulaire";
import { Carte, classesBouton, Page } from "@/components/ui";
import { EnTeteSalarie } from "./en-tete-salarie";
import { definirAccordWhatsAppSalarie, enregistrerSortie, envoyerWhatsAppEssai, modifierSalarie, reintegrerSalarie } from "../actions";
import { ChampsSalarie } from "../champs-salarie";

export const metadata: Metadata = { title: "Fiche salarié" };

export default async function PageSalarie({ params }: PageProps<"/espace/entreprises/[id]/salaries/[salarieId]">) {
  const { id, salarieId } = await params;
  const { supabase } = await exigerUtilisateur();

  // La RLS ne renvoie la fiche qu'aux personnes ayant accès à l'entreprise.
  const [{ data: salarie }, { data: entreprise }, { data: peutGerer }] = await Promise.all([
    supabase
      .from("salaries")
      .select("id, matricule, nom, prenoms, sexe, date_naissance, nationalite, poste, localisation, date_embauche, telephone, email, adresse, numero_cnss, numero_cnamgs, banque, numero_compte, mode_paiement, accord_whatsapp_le, statut, date_sortie, motif_sortie, modifie_le")
      .eq("id", salarieId)
      .eq("entreprise_id", id)
      .maybeSingle(),
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
  ]);
  if (!salarie || !entreprise) notFound();
  const modifiable = peutGerer === true;
  const sorti = salarie.statut === "sorti";

  return (
    <Page>
      <EnTeteSalarie entrepriseId={id} raisonSociale={entreprise.raison_sociale} salarie={salarie} onglet="fiche" />

      {sorti && (
        <p className="rounded-lg border border-bordure bg-surface px-4 py-3 text-sm">
          <strong>Sortie du personnel</strong> le {formaterDate(salarie.date_sortie!)} : {salarie.motif_sortie}
        </p>
      )}

      <Carte
        titre="Fiche salarié"
        description={`${modifiable ? "" : "Consultation seule · "}Mise à jour le ${formaterDate(salarie.modifie_le)}.`}
      >
        {modifiable ? (
          <Formulaire action={modifierSalarie.bind(null, id, salarie.id)} libelleBouton="Enregistrer" colonnes={2} boutonEnHaut>
            <ChampsSalarie fiche={salarie} />
          </Formulaire>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampsSalarie fiche={salarie} lectureSeule />
          </div>
        )}
      </Carte>

      <Carte titre="Avis de bulletin par WhatsApp" description="Message envoyé à la publication de la paie, avec le lien de l'espace salarié (jamais le bulletin lui-même).">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <MessageCircle size={18} className={salarie.accord_whatsapp_le ? "text-emerald-600" : "text-doux"} aria-hidden />
            {!salarie.telephone
              ? "Aucun numéro de téléphone : ajoutez-le dans la fiche pour pouvoir prévenir ce salarié."
              : salarie.accord_whatsapp_le
                ? `Le salarié a accepté de recevoir les avis par WhatsApp (depuis le ${formaterDate(salarie.accord_whatsapp_le)}).`
                : "Le salarié n'a pas encore accepté de recevoir les avis par WhatsApp."}
          </p>
          {modifiable && salarie.telephone && (
            <div className="flex flex-wrap items-start gap-2">
              {salarie.accord_whatsapp_le && <ActionEnLigne action={envoyerWhatsAppEssai.bind(null, id, salarie.id)} libelle="Envoyer un message WhatsApp d'essai" />}
              <ActionEnLigne
                action={definirAccordWhatsAppSalarie.bind(null, id, salarie.id, !salarie.accord_whatsapp_le)}
                libelle={salarie.accord_whatsapp_le ? "Retirer l'accord" : "Le salarié a donné son accord"}
                variante={salarie.accord_whatsapp_le ? "discret" : "secondaire"}
              />
            </div>
          )}
        </div>
      </Carte>

      {modifiable && !sorti && (
        <details className="rounded-xl border border-bordure bg-surface p-4">
          <summary className={`${classesBouton("danger", "petit")} cursor-pointer list-none`}>
            <LogOut size={14} aria-hidden /> Enregistrer une sortie du personnel
          </summary>
          <div className="mt-4">
            <p className="mb-4 text-sm text-doux">
              Le salarié n&apos;est pas supprimé : sa fiche et son historique restent consultables.
            </p>
            <Formulaire action={enregistrerSortie.bind(null, id, salarie.id)} libelleBouton="Confirmer la sortie" colonnes={2}>
              <Champ nom="date_sortie" libelle="Date de sortie" type="date" requis />
              <Champ nom="motif_sortie" libelle="Motif" requis aide="Démission, fin de CDD, licenciement, retraite…" />
            </Formulaire>
          </div>
        </details>
      )}

      {modifiable && sorti && (
        <form action={reintegrerSalarie.bind(null, id, salarie.id)}>
          <button type="submit" className={classesBouton("secondaire", "petit")}>
            <RotateCcw size={14} aria-hidden /> Réintégrer ce salarié
          </button>
        </form>
      )}
    </Page>
  );
}
