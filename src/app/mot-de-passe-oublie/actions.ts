"use server";

import { z } from "zod";
import { lienReinitialisation, reserverEnvoi } from "@/lib/admin/comptes";
import { envoyerEmail } from "@/lib/email/envoyer";
import { emailRecuperation } from "@/lib/email/modeles";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { error: "L'adresse email n'est pas valide." }),
});

// Même réponse que le compte existe ou non : on ne révèle jamais
// quelles adresses sont inscrites sur la plateforme.
const REPONSE =
  "Si un compte existe pour cette adresse, un email vient d'être envoyé avec un lien pour choisir un nouveau mot de passe (valable 24 h). Pensez à vérifier vos courriers indésirables.";

export async function demanderReinitialisation(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const lu = lireFormulaire(schema, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const { email } = lu.donnees;

  // Au plus un email toutes les 5 minutes par adresse (anti-abus).
  if (await reserverEnvoi(`recuperation:${email}`, 300)) {
    const lien = await lienReinitialisation(email);
    if (lien) {
      try {
        await envoyerEmail(email, emailRecuperation({ lien }));
      } catch (erreur) {
        console.error("Email de réinitialisation non envoyé :", erreur);
      }
    }
  }
  return { succes: REPONSE };
}
