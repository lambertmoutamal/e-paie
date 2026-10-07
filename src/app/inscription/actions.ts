"use server";

import { creerCompteInscription, reserverEnvoi } from "@/lib/admin/comptes";
import { adresseSite, envoyerEmail } from "@/lib/email/envoyer";
import { emailCompteExistant, emailInscription } from "@/lib/email/modeles";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaInscription } from "@/lib/validation/schemas";

// Même réponse dans tous les cas : on ne révèle jamais si une adresse est déjà inscrite.
const REPONSE =
  "Merci ! Un email vient de vous être envoyé. Cliquez sur « Activer mon compte » pour confirmer votre adresse et commencer (pensez à vérifier vos courriers indésirables).";

export async function inscrire(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const lu = lireFormulaire(schemaInscription, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { type, formule, nom_structure, nom_complet, email } = lu.donnees;

  // Anti-abus : une tentative toutes les 5 minutes par adresse.
  if (!(await reserverEnvoi(`inscription:${email}`, 300))) return { succes: REPONSE };

  try {
    const lien = await creerCompteInscription(email, nom_complet, { type, nom_structure, formule });
    const site = adresseSite();
    await envoyerEmail(
      email,
      lien
        ? emailInscription({ nom: nom_complet, structure: nom_structure, lien, pro: formule === "pro" })
        : emailCompteExistant({ lienConnexion: `${site}/connexion`, lienMotDePasse: `${site}/mot-de-passe-oublie` }),
    );
  } catch (erreur) {
    console.error("Inscription impossible :", erreur);
    return { erreur: "L'inscription n'a pas pu aboutir. Réessayez dans quelques minutes.", valeurs: lu.valeurs };
  }
  return { succes: REPONSE };
}
