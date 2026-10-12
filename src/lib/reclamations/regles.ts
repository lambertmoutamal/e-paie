// Règles des réclamations (navigateur et serveur).

import { z } from "zod";

export const SUJETS_RECLAMATION = {
  bulletin: { libelle: "Bulletin de paie", traite_par: "le gestionnaire de paie" },
  conges: { libelle: "Congés et solde", traite_par: "le service RH" },
  contrat: { libelle: "Contrat ou documents", traite_par: "le service RH" },
  attestation: { libelle: "Attestation à fournir", traite_par: "le service RH" },
  autre: { libelle: "Autre question", traite_par: "le service RH" },
} as const;
export type SujetReclamation = keyof typeof SUJETS_RECLAMATION;

export const STATUTS_RECLAMATION = {
  ouverte: { libelle: "Ouverte", teinte: "ambre" },
  en_cours: { libelle: "En cours", teinte: "bleu" },
  resolue: { libelle: "Résolue", teinte: "vert" },
  fermee: { libelle: "Close", teinte: "gris" },
} as const;
export type StatutReclamation = keyof typeof STATUTS_RECLAMATION;

const SUJETS = Object.keys(SUJETS_RECLAMATION) as [SujetReclamation, ...SujetReclamation[]];
const message = z.string().trim().min(1, "Écrivez votre message.").max(3000, "3 000 caractères maximum.");

export const schemaNouvelleReclamation = z.object({
  sujet: z.enum(SUJETS, "Choisissez le sujet."),
  objet: z.string().trim().min(3, "Résumez en quelques mots (3 caractères au moins).").max(120, "120 caractères maximum."),
  message,
  bulletin_id: z
    .string()
    .optional()
    .transform((v) => (v && v !== "aucun" ? v : null))
    .refine((v) => v === null || /^[0-9a-f-]{36}$/.test(v), "Bulletin invalide."),
});

export const schemaMessageReclamation = z.object({
  contenu: message,
  resoudre: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
