import { z } from "zod";

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORMAT_TELEPHONE = /^\+?[0-9 .-]{8,20}$/;

const obligatoire = (libelle: string) =>
  z.string().trim().min(1, { error: `${libelle} est obligatoire.` });

// Champ facultatif : une saisie vide devient « null » en base.
const facultatif = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const emailObligatoire = z
  .string()
  .trim()
  .toLowerCase()
  .regex(FORMAT_EMAIL, { error: "L'adresse email n'est pas valide." });

const emailFacultatif = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || FORMAT_EMAIL.test(v), { error: "L'adresse email n'est pas valide." })
  .transform((v) => (v === "" ? null : v));

const telephoneFacultatif = z
  .string()
  .trim()
  .refine((v) => v === "" || FORMAT_TELEPHONE.test(v), {
    error: "Numéro de téléphone invalide (exemple : +241 06 12 34 56).",
  })
  .transform((v) => (v === "" ? null : v));

export const ROLES_ENTREPRISE = ["gestionnaire_paie", "controleur", "signataire", "rh"] as const;
export const MODES_ENTREPRISE = ["cabinet", "autonome"] as const;

export const schemaCabinet = z
  .object({
    nom: obligatoire("Le nom du cabinet"),
    nif: facultatif,
    telephone: telephoneFacultatif,
    email: emailFacultatif,
    adresse: facultatif,
    // Premier administrateur du cabinet (facultatif à la création)
    admin_email: emailFacultatif,
    admin_nom: facultatif,
  })
  .refine((d) => !d.admin_email || d.admin_nom, {
    error: "Indiquez le nom de l'administrateur.",
    path: ["admin_nom"],
  });

export const schemaEntreprise = z.object({
  raison_sociale: obligatoire("La raison sociale"),
  nif: facultatif,
  rccm: facultatif,
  numero_cnss: facultatif,
  adresse: facultatif,
  telephone: telephoneFacultatif,
  email: emailFacultatif,
  mode: z.enum(MODES_ENTREPRISE, { error: "Mode d'utilisation invalide." }),
});

export const schemaNouvelleEntreprise = schemaEntreprise.extend({
  cabinet_id: z.uuid({ error: "Choisissez un cabinet." }),
});

export const schemaNouveauMembre = z.object({
  email: emailObligatoire,
  nom_complet: obligatoire("Le nom complet"),
});

export const schemaNouvelleAffectation = schemaNouveauMembre.extend({
  role: z.enum(ROLES_ENTREPRISE, { error: "Choisissez un rôle." }),
});

export const schemaProfil = z.object({
  nom_complet: obligatoire("Le nom complet"),
});

export const schemaMotDePasse = z
  .object({
    mot_de_passe: z
      .string()
      .min(10, { error: "Le mot de passe doit contenir au moins 10 caractères." })
      .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
        error: "Le mot de passe doit contenir au moins une lettre et un chiffre.",
      }),
    confirmation: z.string(),
  })
  .refine((d) => d.mot_de_passe === d.confirmation, {
    error: "Les deux mots de passe ne sont pas identiques.",
    path: ["confirmation"],
  });
