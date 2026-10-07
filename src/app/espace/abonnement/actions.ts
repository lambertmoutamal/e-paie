"use server";

import { refresh } from "next/cache";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { alerterEquipe } from "@/lib/email/envoyer";
import { emailAlerte } from "@/lib/email/modeles";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaActivationAbonnement, schemaFormule } from "@/lib/validation/schemas";

// Le client demande à passer à Pro (en attendant le paiement en ligne, l'équipe le contacte).
export async function demanderPassagePro(abonnementId: string, titulaire: string): Promise<EtatFormulaire> {
  const { supabase, utilisateur } = await exigerUtilisateur();
  const { error } = await supabase.rpc("demander_passage_pro", { p_abonnement_id: abonnementId });
  if (error) return { erreur: "Demande impossible." };

  const { profil } = await droitsUtilisateur();
  await alerterEquipe(
    emailAlerte({
      titre: "Demande de passage à Pro",
      lignes: [
        ["Structure", titulaire],
        ["Contact", profil?.nom_complet || ""],
        ["Email", utilisateur.email ?? ""],
      ],
    }),
  );
  refresh();
  return { succes: "Demande envoyée : notre équipe vous contacte très vite." };
}

// Administrateur plateforme : active ou prolonge un abonnement (après paiement hors ligne).
// La base refuse cette modification à toute autre personne.
export async function activerAbonnement(
  abonnementId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaActivationAbonnement, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data: formule } = await supabase.from("formules").select("est_essai").eq("id", lu.donnees.formule_id).single();
  const { data, error } = await supabase
    .from("abonnements")
    .update({
      formule_id: lu.donnees.formule_id,
      statut: formule?.est_essai ? "essai" : "actif",
      fin: `${lu.donnees.fin}T23:59:59Z`,
    })
    .eq("id", abonnementId)
    .select("id");
  if (error || !data?.length) return { erreur: "Modification refusée.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Abonnement mis à jour." };
}

export async function modifierFormule(formuleId: string, _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaFormule, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase.from("formules").update(lu.donnees).eq("id", formuleId).select("id");
  if (error || !data?.length) return { erreur: "Modification refusée.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Formule enregistrée." };
}
