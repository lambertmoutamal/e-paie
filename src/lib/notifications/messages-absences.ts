// Contenu des alertes de congés (email et WhatsApp), sans dépendance : facile à tester.

import { formaterJours, libelleDates } from "@/lib/absences/regles";

type Periode = { debut: string; fin: string; nb_jours: number | string };

// Au RH (ou à l'administrateur) : une nouvelle demande attend une réponse.
export function contenuNouvelleDemande(p: Periode & { nom: string; salarie: string; type: string; entreprise: string; lien: string }) {
  const prenom = p.nom.trim().split(/\s+/)[0] || "Bonjour";
  const quand = `${libelleDates(p)} (${formaterJours(p.nb_jours)})`;
  const action = `répondre à la demande « ${p.type} » de ${p.salarie} (${p.entreprise}), ${quand}`;
  return {
    sujet: `Demande d'absence à traiter : ${p.salarie} — ${p.entreprise}`,
    titre: `Bonjour ${prenom}`,
    paragraphes: [`${p.salarie} (${p.entreprise}) demande : ${p.type}, ${quand}.`, "Acceptez ou refusez la demande (un refus doit être motivé)."],
    bouton: "Répondre à la demande",
    whatsapp: `e-Paie — Bonjour ${prenom}, une action vous attend : ${action}. ${p.lien}`,
    variables: { "1": prenom, "2": action, "3": p.lien },
  };
}

// Au salarié : la réponse à sa demande (ou une absence saisie par le RH).
export function contenuDecision(p: Periode & { prenoms: string; type: string; entreprise: string; statut: string; commentaire: string | null; lien: string }) {
  const prenom = p.prenoms.trim().split(/\s+/)[0] || "Bonjour";
  const quand = `${libelleDates(p)} (${formaterJours(p.nb_jours)})`;
  const resultat =
    p.statut === "acceptee" ? "a été acceptée" : p.statut === "refusee" ? "a été refusée" : p.statut === "annulee" ? "a été annulée" : "est en attente";
  const motif = p.commentaire ? ` Commentaire : « ${p.commentaire} ».` : "";
  const texte = `Votre demande « ${p.type} » ${quand} ${resultat} (${p.entreprise}).${motif}`;
  return {
    sujet: `Votre demande d'absence ${resultat}`,
    titre: `Bonjour ${prenom}`,
    paragraphes: [texte],
    bouton: "Voir mes absences",
    whatsapp: `e-Paie — Bonjour ${prenom}. ${texte} ${p.lien}`,
    variables: { "1": prenom, "2": `consulter la réponse à votre demande « ${p.type} » ${quand} : elle ${resultat}`, "3": p.lien },
  };
}
