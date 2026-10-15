"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaDemande } from "@/lib/absences/regles";
import { verifierFichier } from "@/lib/contrats/regles";
import { alerterNouvelleDemande } from "@/lib/notifications/alertes-absences";
import { utilisateurConnecte } from "@/lib/auth/connecte";

// Le salarié agit avec sa propre session : la base vérifie qu'il s'agit bien de
// SA fiche, que le type est autorisé, les limites de jours et le justificatif.

async function session() {
  const supabase = await clientSupabaseServeur();
  const data = { user: await utilisateurConnecte(supabase) };
  if (!data.user) redirect("/portail/connexion");
  return supabase;
}

const EXTENSIONS: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function demanderAbsence(salarieId: string, entrepriseId: string, _e: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const supabase = await session();
  const lu = lireFormulaire(schemaDemande, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  // Justificatif facultatif (photo ou PDF), rangé dans le dossier du salarié
  const fichier = formulaire.get("fichier");
  let justificatif: string | null = null;
  if (fichier instanceof File && fichier.size > 0) {
    const probleme = verifierFichier(fichier);
    if (probleme) return { erreurs: { fichier: probleme }, valeurs: lu.valeurs };
    justificatif = `${entrepriseId}/${salarieId}/${randomUUID()}.${EXTENSIONS[fichier.type] ?? "pdf"}`;
    const { error } = await supabase.storage.from("absences").upload(justificatif, fichier, { contentType: fichier.type, upsert: false });
    if (error) return { erreurs: { fichier: "Le justificatif n'a pas pu être envoyé." }, valeurs: lu.valeurs };
  }

  const { data, error } = await supabase.rpc("demander_absence", {
    p_salarie_id: salarieId,
    p_type_id: lu.donnees.type_id,
    p_debut: lu.donnees.debut,
    p_fin: lu.donnees.fin,
    p_debut_apres_midi: lu.donnees.debut_apres_midi,
    p_fin_midi: lu.donnees.fin_midi,
    p_motif: lu.donnees.motif,
    p_justificatif: justificatif,
  });
  if (error) {
    if (justificatif) await supabase.storage.from("absences").remove([justificatif]).catch(() => {});
    return { erreur: error.code === "P0001" ? error.message : "La demande n'a pas pu être envoyée.", valeurs: lu.valeurs };
  }
  after(() => alerterNouvelleDemande(data as string));
  redirect("/portail/absences?envoyee=1");
}

export async function annulerMaDemande(demandeId: string) {
  const supabase = await session();
  await supabase.rpc("annuler_ma_demande", { p_demande_id: demandeId });
  refresh();
}
