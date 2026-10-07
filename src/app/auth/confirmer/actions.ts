"use server";

import { redirect } from "next/navigation";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { definirObligationMotDePasse } from "@/lib/admin/comptes";
import { TYPES_LIEN, type TypeLien } from "@/lib/email/envoyer";
import type { EtatFormulaire } from "@/lib/validation/formulaire";

// Vérifie le lien reçu par email (preuve que la boîte mail appartient à la personne),
// ouvre la session, puis envoie vers le choix du mot de passe.
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

  // Après un « mot de passe oublié », la personne doit obligatoirement en choisir un nouveau.
  if (type === "recovery") {
    await definirObligationMotDePasse(data.user.id, true);
    await supabase.auth.refreshSession();
  }
  redirect("/espace/mot-de-passe");
}
