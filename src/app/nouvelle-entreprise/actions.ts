"use server";

import { after } from "next/server";
import { creerCompteInscription, reserverEnvoi } from "@/lib/admin/comptes";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { adresseSite, alerterEquipe, envoyerEmail } from "@/lib/email/envoyer";
import {
  emailAccuseDemandeEntreprise,
  emailAlerte,
  emailCompteExistant,
  emailInscription,
  emailNouvelleDemandeEntreprise,
} from "@/lib/email/modeles";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaCreationEntreprise } from "@/lib/validation/schemas";

// Même réponse que l'inscription : on ne révèle jamais si une adresse est déjà inscrite.
const REPONSE_AUTONOME =
  "Merci ! Un email vient de vous être envoyé. Cliquez sur « Activer mon compte » pour confirmer votre adresse et commencer votre essai de 30 jours (pensez à vérifier vos courriers indésirables).";

// « Créer une nouvelle entreprise » (sans compte) :
//   - paie autonome : inscription habituelle, avec la fiche complète de l'entreprise ;
//   - paie gérée par un cabinet : demande transmise au cabinet choisi, qui la valide.
export async function creerNouvelleEntreprise(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const lu = lireFormulaire(schemaCreationEntreprise, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const d = lu.donnees;
  const fiche = { nif: d.nif, rccm: d.rccm, numero_cnss: d.numero_cnss, numero_cnamgs: d.numero_cnamgs, adresse: d.adresse, telephone: d.telephone, email: d.email };

  // Anti-abus : une demande toutes les 2 minutes par adresse
  if (!(await reserverEnvoi(`creation-entreprise:${d.contact_email}`, 120))) {
    return { erreur: "Une demande vient déjà d'être envoyée avec cette adresse. Patientez deux minutes avant de réessayer.", valeurs: lu.valeurs };
  }

  if (d.gestion === "autonome") {
    try {
      const lien = await creerCompteInscription(d.contact_email, d.contact_nom, { type: "entreprise", nom_structure: d.raison_sociale, formule: "essai", fiche });
      const site = adresseSite();
      await envoyerEmail(
        d.contact_email,
        lien
          ? emailInscription({ nom: d.contact_nom, structure: d.raison_sociale, lien, pro: false })
          : emailCompteExistant({ lienConnexion: `${site}/connexion`, lienMotDePasse: `${site}/mot-de-passe-oublie` }),
      );
    } catch (erreur) {
      console.error("Création d'entreprise autonome impossible :", erreur);
      return { erreur: "La création n'a pas pu aboutir. Réessayez dans quelques minutes.", valeurs: lu.valeurs };
    }
    return { succes: REPONSE_AUTONOME };
  }

  // Paie gérée par un cabinet : la demande attend la validation du cabinet
  const admin = clientSupabaseAdmin();
  const { data: cabinet } = await admin.from("cabinets").select("id, nom").eq("id", d.cabinet_id!).maybeSingle();
  if (!cabinet) return { erreurs: { cabinet_id: "Ce cabinet n'existe plus. Choisissez-en un autre." }, valeurs: lu.valeurs };

  const { data: demande, error } = await admin
    .from("demandes_entreprise")
    .insert({
      cabinet_id: cabinet.id,
      raison_sociale: d.raison_sociale,
      ...fiche,
      nb_salaries: d.nb_salaries,
      contact_nom: d.contact_nom,
      contact_email: d.contact_email,
      contact_telephone: d.contact_telephone,
    })
    .select("id")
    .single();
  if (error || !demande) {
    console.error("Demande d'entreprise impossible :", error?.code, error?.message);
    return { erreur: "La demande n'a pas pu être transmise. Réessayez dans quelques minutes.", valeurs: lu.valeurs };
  }

  // Emails envoyés après la réponse (le formulaire n'attend pas)
  after(async () => {
    const { data: membres } = await admin.from("membres_cabinet").select("profils(email)").eq("cabinet_id", cabinet.id);
    const destinataires = (membres ?? []).map((m) => (m.profils as unknown as { email: string | null } | null)?.email).filter((e): e is string => !!e);
    const lien = `${adresseSite()}/espace/demandes-entreprises`;
    const contact = [d.contact_nom, d.contact_email, d.contact_telephone].filter(Boolean).join(" · ");
    for (const email of destinataires) {
      await envoyerEmail(email, emailNouvelleDemandeEntreprise({ cabinet: cabinet.nom, entreprise: d.raison_sociale, nbSalaries: d.nb_salaries!, contact, lien })).catch((e) =>
        console.error("Alerte cabinet non envoyée :", e),
      );
    }
    await envoyerEmail(d.contact_email, emailAccuseDemandeEntreprise({ nom: d.contact_nom, entreprise: d.raison_sociale, cabinet: cabinet.nom })).catch((e) =>
      console.error("Accusé de réception non envoyé :", e),
    );
    await alerterEquipe(emailAlerte({ titre: "Demande de prise en charge par un cabinet", lignes: [["Entreprise", d.raison_sociale], ["Cabinet", cabinet.nom], ["Salariés", String(d.nb_salaries)]] }));
  });

  return { succes: `Votre demande a été transmise au cabinet ${cabinet.nom} pour validation. Vous recevrez un email dès qu'il l'aura acceptée ; il peut aussi vous écrire pour demander des informations.` };
}
