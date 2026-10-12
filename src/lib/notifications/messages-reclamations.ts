// Contenu des alertes de réclamations (email et WhatsApp), sans dépendance : facile à tester.

import { SUJETS_RECLAMATION, type SujetReclamation } from "@/lib/reclamations/regles";

// Au personnel chargé du sujet : nouvelle réclamation ou nouveau message du salarié.
export function contenuReclamationPersonnel(p: { nom: string; salarie: string; entreprise: string; sujet: string; objet: string; lien: string }) {
  const prenom = p.nom.trim().split(/\s+/)[0] || "Bonjour";
  const sujet = SUJETS_RECLAMATION[p.sujet as SujetReclamation]?.libelle ?? p.sujet;
  const action = `répondre à la réclamation « ${p.objet} » de ${p.salarie} (${p.entreprise}, ${sujet.toLowerCase()})`;
  return {
    sujet: `Réclamation à traiter : ${p.objet} — ${p.salarie}`,
    titre: `Bonjour ${prenom}`,
    paragraphes: [`${p.salarie} (${p.entreprise}) attend votre réponse à sa réclamation « ${p.objet} » (${sujet}).`, "Répondez dans le fil d'échange ; marquez-la résolue une fois le problème réglé."],
    bouton: "Répondre",
    whatsapp: `DématPaie — Bonjour ${prenom}, une action vous attend : ${action}. ${p.lien}`,
    variables: { "1": prenom, "2": action, "3": p.lien },
  };
}

// Au salarié : l'entreprise a répondu (ou a résolu la réclamation).
export function contenuReponseSalarie(p: { prenoms: string; entreprise: string; objet: string; statut: string; lien: string }) {
  const prenom = p.prenoms.trim().split(/\s+/)[0] || "Bonjour";
  const resolue = p.statut === "resolue";
  const texte = resolue
    ? `Votre réclamation « ${p.objet} » a été marquée comme résolue par ${p.entreprise}. Confirmez, ou répondez si le problème persiste.`
    : `${p.entreprise} a répondu à votre réclamation « ${p.objet} ».`;
  return {
    sujet: resolue ? "Votre réclamation est résolue" : "Réponse à votre réclamation",
    titre: `Bonjour ${prenom}`,
    paragraphes: [texte],
    bouton: "Voir la réponse",
    whatsapp: `DématPaie — Bonjour ${prenom}. ${texte} ${p.lien}`,
    variables: { "1": prenom, "2": `lire la réponse à votre réclamation « ${p.objet} »`, "3": p.lien },
  };
}
