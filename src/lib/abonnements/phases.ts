// Textes affichés selon la phase de l'abonnement (calculée par la base de données).
export type Phase = "essai" | "actif" | "lecture_seule" | "bloque" | "gere";

export const DUREE_LECTURE_SEULE_JOURS = 30;

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function formaterDate(date: string | Date): string {
  return DATE.format(new Date(date));
}

export function libellePhase(phase: Phase): { libelle: string; teinte: "vert" | "bleu" | "ambre" | "rouge" | "gris" } {
  switch (phase) {
    case "essai":
      return { libelle: "Essai gratuit", teinte: "bleu" };
    case "actif":
      return { libelle: "Actif", teinte: "vert" };
    case "lecture_seule":
      return { libelle: "Lecture seule", teinte: "ambre" };
    case "bloque":
      return { libelle: "Bloqué", teinte: "rouge" };
    default:
      return { libelle: "Géré par la plateforme", teinte: "gris" };
  }
}

// Message du bandeau en haut de l'espace (null = rien à signaler).
export function messageBandeau(a: {
  phase: Phase;
  titulaire: string;
  jours_restants: number;
  fin_lecture_seule: string;
}): { niveau: "info" | "alerte" | "danger"; texte: string } | null {
  switch (a.phase) {
    case "essai":
      return {
        niveau: a.jours_restants <= 7 ? "alerte" : "info",
        texte:
          a.jours_restants === 0
            ? `${a.titulaire} : votre essai gratuit se termine aujourd'hui.`
            : `${a.titulaire} : essai gratuit, ${a.jours_restants} jour${a.jours_restants > 1 ? "s" : ""} restant${a.jours_restants > 1 ? "s" : ""}.`,
      };
    case "lecture_seule":
      return {
        niveau: "alerte",
        texte: `${a.titulaire} : abonnement terminé. Consultation seule jusqu'au ${formaterDate(a.fin_lecture_seule)}, puis l'accès sera bloqué pour tous, salariés compris.`,
      };
    case "bloque":
      return { niveau: "danger", texte: `${a.titulaire} : accès bloqué. Souscrivez un abonnement pour le rétablir.` };
    default:
      return null;
  }
}
