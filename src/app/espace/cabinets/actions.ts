"use server";

import { refresh } from "next/cache";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { ajouterAdminCabinet, renvoyerInvitation } from "@/lib/admin/membres";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaCabinet, schemaNouveauMembre } from "@/lib/validation/schemas";

export async function creerCabinet(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaCabinet, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  if (!(await estAdminPlateforme(supabase))) {
    return { erreur: "Action réservée à l'administrateur plateforme." };
  }

  const { admin_email, admin_nom, ...cabinet } = lu.donnees;
  const { data, error } = await supabase.from("cabinets").insert(cabinet).select("id").single();
  if (error || !data) return { erreur: "Le cabinet n'a pas pu être créé.", valeurs: lu.valeurs };

  let message = "";
  if (admin_email && admin_nom) {
    const resultat = await ajouterAdminCabinet(supabase, data.id, admin_email, admin_nom);
    refresh();
    if ("erreur" in resultat) return { erreur: `Cabinet créé, mais : ${resultat.erreur}` };
    message = ` ${resultat.message}`;
  }

  refresh();
  return { succes: `Cabinet « ${cabinet.nom} » créé.${message}` };
}

export async function ajouterAdministrateur(
  cabinetId: string,
  _etat: EtatFormulaire,
  formulaire: FormData,
): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const lu = lireFormulaire(schemaNouveauMembre, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };

  const resultat = await ajouterAdminCabinet(supabase, cabinetId, lu.donnees.email, lu.donnees.nom_complet);
  if ("erreur" in resultat) return { erreur: resultat.erreur, valeurs: lu.valeurs };

  refresh();
  return { succes: resultat.message };
}

export async function renvoyerInvitationAdmin(cabinetId: string, profilId: string): Promise<EtatFormulaire> {
  const { supabase } = await exigerUtilisateur();
  const resultat = await renvoyerInvitation(supabase, profilId, { cabinetId });
  return "erreur" in resultat ? { erreur: resultat.erreur } : { succes: resultat.message };
}
