"use server";

import { refresh } from "next/cache";
import { estAdminPlateforme, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { ajouterAdminCabinet } from "@/lib/admin/membres";
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

  let compteCree;
  if (admin_email && admin_nom) {
    const resultat = await ajouterAdminCabinet(supabase, data.id, admin_email, admin_nom);
    if ("erreur" in resultat) {
      refresh();
      return { erreur: `Cabinet créé, mais : ${resultat.erreur}` };
    }
    compteCree = resultat.compteCree;
  }

  refresh();
  return { succes: `Cabinet « ${cabinet.nom} » créé.`, compteCree };
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
  return { succes: `${lu.donnees.nom_complet} est maintenant administrateur du cabinet.`, compteCree: resultat.compteCree };
}
