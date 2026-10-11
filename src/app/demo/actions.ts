"use server";

import { headers } from "next/headers";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { reserverEnvoi } from "@/lib/admin/comptes";
import { alerterEquipe, envoyerEmail } from "@/lib/email/envoyer";
import { emailAccuseDemo, emailAlerte } from "@/lib/email/modeles";
import { lireFormulaire, type EtatFormulaire } from "@/lib/validation/formulaire";
import { schemaDemandeDemo } from "@/lib/validation/schemas";

const TYPES = { cabinet: "Cabinet comptable", entreprise: "Entreprise", autre: "Autre" } as const;

export async function demanderDemo(_etat: EtatFormulaire, formulaire: FormData): Promise<EtatFormulaire> {
  // Piège à robots : champ invisible pour un humain, rempli par les robots.
  if (String(formulaire.get("site_web") ?? "") !== "") return { succes: "Merci, votre demande a bien été envoyée." };

  const lu = lireFormulaire(schemaDemandeDemo, formulaire);
  if (!lu.ok) return { erreurs: lu.erreurs, valeurs: lu.valeurs };
  const demande = lu.donnees;

  // Anti-abus : une demande par adresse email toutes les 10 minutes, et par connexion toutes les 2 minutes.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  const autorise = (await reserverEnvoi(`demo-ip:${ip}`, 120)) && (await reserverEnvoi(`demo:${demande.email}`, 600));
  if (!autorise) return { succes: "Merci, votre demande a bien été envoyée. Nous vous recontactons rapidement." };

  const { error } = await clientSupabaseAdmin().from("demandes_demo").insert(demande);
  if (error) {
    console.error("Demande de démo non enregistrée :", error);
    return { erreur: "Votre demande n'a pas pu être envoyée. Réessayez dans un instant.", valeurs: lu.valeurs };
  }

  await alerterEquipe(
    emailAlerte({
      titre: "Nouvelle demande de démo",
      lignes: [
        ["Nom", demande.nom],
        ["Structure", `${demande.structure} (${TYPES[demande.type]})`],
        ["Email", demande.email],
        ["Téléphone", demande.telephone ?? "—"],
        ["Effectif", demande.effectif ?? "—"],
        ["Message", demande.message ?? "—"],
      ],
    }),
  );
  try {
    await envoyerEmail(demande.email, emailAccuseDemo({ nom: demande.nom }));
  } catch (erreur) {
    console.error("Accusé de réception non envoyé :", erreur);
  }

  return { succes: "Merci ! Votre demande a bien été envoyée. Nous vous recontactons très prochainement." };
}
