// Contenu des alertes de paie (email et WhatsApp), sans dépendance : facile à tester.

import { libellePeriode, libelleRole } from "@/lib/bulletins/regles";

export type MotifAlerte = "a_valider" | "a_publier" | "a_corriger" | "sans_validateur";

export type InfosAlerte = {
  motif: MotifAlerte;
  nom: string;
  entreprise: string;
  annee: number;
  mois: number;
  etape: string;
  commentaire: string | null;
  lien: string;
};

export type ContenuAlerte = {
  sujet: string;
  titre: string;
  paragraphes: string[]; // texte brut (échappé lors de la mise en forme de l'email)
  bouton: string;
  whatsapp: string;
  // Variables du modèle WhatsApp approuvé : {{1}} prénom, {{2}} action, {{3}} lien
  variables: Record<"1" | "2" | "3", string>;
};

export const LIBELLES_ACTION: Record<MotifAlerte, string> = {
  a_valider: "Validation",
  a_publier: "Publication",
  a_corriger: "Correction",
  sans_validateur: "Rôle à attribuer",
};

export function contenuAlerte(i: InfosAlerte): ContenuAlerte {
  const periode = libellePeriode(i.annee, i.mois);
  const prenom = i.nom.trim().split(/\s+/)[0] || "Bonjour";
  // Pour « sans_validateur », le commentaire porte le rôle manquant (ex. signataire)
  const motifRefus = i.commentaire && i.motif !== "sans_validateur" ? `Motif du refus : « ${i.commentaire} »` : null;
  const roleManquant = libelleRole(i.commentaire ?? "").toLowerCase();

  const parMotif: Record<MotifAlerte, { sujet: string; action: string; paragraphes: string[]; bouton: string }> = {
    a_valider: {
      sujet: `À valider : paie de ${periode} — ${i.entreprise}`,
      action: `valider l'étape « ${i.etape} » de la paie de ${periode} (${i.entreprise})`,
      paragraphes: [
        `La paie de ${periode} de ${i.entreprise} attend votre validation, étape « ${i.etape} ».`,
        ...(motifRefus ? [`Elle vous revient après un refus à l'étape suivante. ${motifRefus}`] : []),
        "Vérifiez les bulletins puis validez ou refusez (avec un commentaire).",
      ],
      bouton: "Voir et valider",
    },
    a_publier: {
      sujet: `Prête à publier : paie de ${periode} — ${i.entreprise}`,
      action: `publier la paie de ${periode} (${i.entreprise}), approuvée`,
      paragraphes: [
        `La paie de ${periode} de ${i.entreprise} a été approuvée.`,
        "Vous pouvez maintenant la publier : chaque salarié verra son bulletin dans son espace.",
      ],
      bouton: "Publier aux salariés",
    },
    sans_validateur: {
      sujet: `Paie bloquée, rôle à attribuer : ${periode} — ${i.entreprise}`,
      action: `attribuer le rôle « ${roleManquant} » dans ${i.entreprise} : personne ne peut valider l'étape « ${i.etape} » de la paie de ${periode}`,
      paragraphes: [
        `La paie de ${periode} de ${i.entreprise} est bloquée à l'étape « ${i.etape} » : aucune personne ne peut la valider.`,
        `Cette étape doit être validée par : ${roleManquant}. Attribuez ce rôle à une personne (autre que celles qui ont préparé ou déjà validé la paie) dans les utilisateurs de l'entreprise, ou modifiez le circuit de validation.`,
      ],
      bouton: "Gérer les utilisateurs",
    },
    a_corriger: {
      sujet: `Refusée, à corriger : paie de ${periode} — ${i.entreprise}`,
      action: `corriger la paie de ${periode} (${i.entreprise}), refusée`,
      paragraphes: [
        `La paie de ${periode} de ${i.entreprise} a été refusée et revient en brouillon.`,
        ...(motifRefus ? [motifRefus] : []),
        "Corrigez les bulletins concernés, puis renvoyez la période en validation.",
      ],
      bouton: "Corriger",
    },
  };

  const m = parMotif[i.motif];
  return {
    sujet: m.sujet,
    titre: `Bonjour ${prenom}`,
    paragraphes: m.paragraphes,
    bouton: m.bouton,
    whatsapp: `e-Paie — Bonjour ${prenom}, une action vous attend : ${m.action}.${motifRefus ? ` ${motifRefus}.` : ""} ${i.lien}`,
    variables: { "1": prenom, "2": m.action, "3": i.lien },
  };
}
