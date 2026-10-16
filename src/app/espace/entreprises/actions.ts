"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { affecterPersonne, renvoyerInvitation } from "@/lib/admin/membres";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { schemaZone, typeImage } from "@/lib/bulletins/regles-signature";
import {
  schemaEntreprise,
  schemaNouvelleAffectation,
} from "@/lib/validation/schemas";

export async function modifierEntreprise(
  entrepriseId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaEntreprise, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { data, error } = await supabase
    .from("entreprises")
    .update(lu.donnees)
    .eq("id", entrepriseId)
    .select("id");
  if (error || !data?.length) return { erreur: "Modification refusée ou impossible.", valeurs: lu.valeurs };

  refresh();
  return { succes: "Fiche enregistrée." };
}

export async function ajouterUtilisateur(
  entrepriseId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaNouvelleAffectation, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const { email, nom_complet, role } = lu.donnees;
  const resultat = await affecterPersonne(supabase, entrepriseId, email, nom_complet, role);
  if ("erreur" in resultat) return { erreur: resultat.erreur, valeurs: lu.valeurs };

  refresh();
  return { succes: resultat.message };
}

export async function renvoyerInvitationEntreprise(entrepriseId: string, profilId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const resultat = await renvoyerInvitation(supabase, profilId, { entrepriseId });
  return "erreur" in resultat ? { erreur: resultat.erreur } : { succes: resultat.message };
}

// Retirer un accès ne supprime rien : l'affectation est désactivée (et tracée).
export async function changerAcces(entrepriseId: string, profilId: string, role: string, actif: boolean) {
  const { supabase } = await exigerUtilisateur();
  await supabase
    .from("affectations")
    .update({ actif })
    .eq("entreprise_id", entrepriseId)
    .eq("profil_id", profilId)
    .eq("role", role);
  refresh();
}

// ---------------------------------------------------------------------
// Signature et cachet apposés sur les bulletins à la validation finale
// ---------------------------------------------------------------------

const TAILLE_MAX_IMAGE = 1024 * 1024; // 1 Mo

async function verifierGestion(entrepriseId: string) {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: entrepriseId });
  return { supabase, autorise: data === true };
}

// Dépôt de l'image de signature ou du cachet (PNG de préférence, fond transparent).
// Les images sont rangées dans un espace privé, lu uniquement par le serveur.
export async function deposerImageSignature(entrepriseId: string, type: "signature" | "cachet", _etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase, autorise } = await verifierGestion(entrepriseId);
  if (!autorise) return { erreur: "Seul un administrateur de l'entreprise peut déposer la signature et le cachet." };
  const fichier = formulaire.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisissez une image (PNG ou JPEG)." };
  if (fichier.size > TAILLE_MAX_IMAGE) return { erreur: "Image trop lourde (1 Mo maximum)." };
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const format = typeImage(octets);
  if (!format) return { erreur: "Ce fichier n'est pas une image PNG ou JPEG." };

  const chemin = `${entrepriseId}/${type}-${randomUUID()}.${format === "png" ? "png" : "jpg"}`;
  const admin = clientSupabaseAdmin();
  const { error: erreurDepot } = await admin.storage.from("signatures").upload(chemin, octets, { contentType: format === "png" ? "image/png" : "image/jpeg" });
  if (erreurDepot) return { erreur: "L'image n'a pas pu être enregistrée." };

  const colonne = type === "signature" ? "signature_chemin" : "cachet_chemin";
  const { data: avant } = await supabase.from("entreprises").select(colonne).eq("id", entrepriseId).maybeSingle();
  const { error } = await supabase.from("entreprises").update({ [colonne]: chemin }).eq("id", entrepriseId);
  if (error) {
    await admin.storage.from("signatures").remove([chemin]);
    return { erreur: "L'image n'a pas pu être enregistrée (droits ?)." };
  }
  const ancien = (avant as Record<string, string | null> | null)?.[colonne];
  if (ancien) await admin.storage.from("signatures").remove([ancien]);
  refresh();
  return { succes: type === "signature" ? "Signature enregistrée." : "Cachet enregistré." };
}

export async function retirerImageSignature(entrepriseId: string, type: "signature" | "cachet"): Promise<EtatFormulaire> {
  const { supabase, autorise } = await verifierGestion(entrepriseId);
  if (!autorise) return { erreur: "Seul un administrateur de l'entreprise peut modifier la signature et le cachet." };
  const colonne = type === "signature" ? "signature_chemin" : "cachet_chemin";
  const { data: avant } = await supabase.from("entreprises").select(colonne).eq("id", entrepriseId).maybeSingle();
  const { error } = await supabase.from("entreprises").update({ [colonne]: null }).eq("id", entrepriseId);
  if (error) return { erreur: "L'image n'a pas pu être retirée." };
  const ancien = (avant as Record<string, string | null> | null)?.[colonne];
  if (ancien) await clientSupabaseAdmin().storage.from("signatures").remove([ancien]);
  refresh();
  return { succes: "Image retirée." };
}

// Emplacement de la case « Émargement employeur », tracé sur un bulletin modèle
export async function enregistrerZoneEmargement(entrepriseId: string, zone: unknown): Promise<EtatFormulaire> {
  const { supabase, autorise } = await verifierGestion(entrepriseId);
  if (!autorise) return { erreur: "Seul un administrateur de l'entreprise peut régler l'emplacement." };
  const lu = schemaZone.safeParse(zone);
  if (!lu.success) return { erreur: "Tracez la case à l'intérieur de la page." };
  const { error } = await supabase.from("entreprises").update({ zone_emargement: lu.data }).eq("id", entrepriseId);
  if (error) return { erreur: "L'emplacement n'a pas pu être enregistré." };
  refresh();
  return { succes: "Emplacement enregistré : il servira pour tous les bulletins de l'entreprise." };
}
