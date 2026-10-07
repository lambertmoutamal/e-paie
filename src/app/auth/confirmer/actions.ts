"use server";

import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { definirObligationMotDePasse, effacerDemandeInscription } from "@/lib/admin/comptes";
import { alerterEquipe, TYPES_LIEN, type TypeLien } from "@/lib/email/envoyer";
import { emailAlerte } from "@/lib/email/modeles";
import type { EtatFormulaire } from "@/lib/validation/formulaire";

// Vérifie le lien reçu par email (preuve que la boîte mail appartient à la personne),
// ouvre la session, finalise une éventuelle inscription libre, puis envoie vers le
// choix du mot de passe.
export async function confirmerLien(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const jeton = String(formulaire.get("token_hash") ?? "");
  const type = String(formulaire.get("type") ?? "") as TypeLien;
  if (!jeton || !TYPES_LIEN.includes(type)) return { erreur: "Lien invalide." };

  const supabase = await clientSupabaseServeur();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: jeton, type });
  if (error || !data.user) {
    return {
      erreur:
        "Ce lien a expiré ou a déjà été utilisé. Demandez à votre administrateur de vous renvoyer l'invitation, ou utilisez « Mot de passe oublié ».",
    };
  }

  // Inscription libre : création du cabinet ou de l'entreprise et de l'essai gratuit.
  const demande = data.user.app_metadata?.inscription as
    | { type: string; nom_structure: string; formule: string }
    | undefined;
  if (demande) {
    const { error: erreurInscription } = await supabase.rpc("finaliser_inscription");
    if (erreurInscription) {
      console.error("Finalisation de l'inscription impossible :", erreurInscription);
      return { erreur: "Votre compte est confirmé, mais la création de votre espace a échoué. Réessayez dans un instant." };
    }
    await effacerDemandeInscription(data.user.id);
    await alerterEquipe(
      emailAlerte({
        titre: demande.formule === "pro" ? "Nouvelle inscription — souhaite la formule Pro" : "Nouvelle inscription (essai gratuit)",
        lignes: [
          ["Type", demande.type === "cabinet" ? "Cabinet comptable" : "Entreprise"],
          ["Structure", demande.nom_structure],
          ["Contact", String(data.user.user_metadata?.nom_complet ?? "")],
          ["Email", data.user.email ?? ""],
        ],
      }),
    );
  }

  // Après un « mot de passe oublié », la personne doit obligatoirement en choisir un nouveau.
  if (type === "recovery") await definirObligationMotDePasse(data.user.id, true);
  if (demande || type === "recovery") await supabase.auth.refreshSession();

  redirect("/espace/mot-de-passe");
}
