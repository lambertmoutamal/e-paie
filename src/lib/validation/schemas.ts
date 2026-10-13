import { z } from "zod";
import { normaliserTelephoneSalarie } from "@/lib/salaries/regles";

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

export const ROLES_ENTREPRISE = ["admin_entreprise", "gestionnaire_paie", "controleur", "signataire", "rh"] as const;
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
  // Champ ajouté après coup : absent des anciens formulaires, il devient « null »
  numero_cnamgs: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
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

// Inscription libre d'un prospect (cabinet ou entreprise)
export const schemaInscription = z.object({
  type: z.enum(["cabinet", "entreprise"], { error: "Indiquez si vous êtes un cabinet ou une entreprise." }),
  formule: z.enum(["essai", "pro"], { error: "Choisissez une formule." }),
  nom_structure: obligatoire("Le nom de votre structure"),
  nom_complet: obligatoire("Votre nom complet"),
  email: emailObligatoire,
  conditions: z.literal("on", { error: "Vous devez accepter les conditions d'utilisation." }),
});

// « Créer une nouvelle entreprise » (page de connexion, sans compte) : paie autonome
// (inscription) ou gérée par un cabinet (demande transmise au cabinet choisi).
export const schemaCreationEntreprise = z
  .object({
    raison_sociale: obligatoire("La raison sociale"),
    nif: facultatif,
    rccm: facultatif,
    numero_cnss: facultatif,
    numero_cnamgs: facultatif,
    adresse: facultatif,
    telephone: telephoneFacultatif,
    email: emailFacultatif,
    contact_nom: obligatoire("Votre nom complet"),
    contact_email: emailObligatoire,
    contact_telephone: telephoneFacultatif,
    gestion: z.enum(["autonome", "cabinet"], { error: "Indiquez qui fait la paie de l'entreprise." }),
    cabinet_id: z.string().trim().optional(),
    nb_salaries: z.string().trim().optional(),
    conditions: z.literal("on", { error: "Vous devez accepter les conditions d'utilisation." }),
  })
  .superRefine((d, ctx) => {
    if (d.gestion !== "cabinet") return;
    if (!d.cabinet_id || !z.uuid().safeParse(d.cabinet_id).success) {
      ctx.addIssue({ code: "custom", path: ["cabinet_id"], message: "Choisissez le cabinet qui fera votre paie." });
    }
    const n = Number(d.nb_salaries);
    if (!d.nb_salaries || !Number.isInteger(n) || n < 1 || n > 100000) {
      ctx.addIssue({ code: "custom", path: ["nb_salaries"], message: "Indiquez le nombre de salariés (un nombre entier)." });
    }
  })
  .transform((d) => ({
    ...d,
    cabinet_id: d.gestion === "cabinet" ? (d.cabinet_id ?? null) : null,
    nb_salaries: d.gestion === "cabinet" ? Number(d.nb_salaries) : null,
  }));

// Demande de démonstration (formulaire public du site vitrine)
export const schemaDemandeDemo = z.object({
  nom: obligatoire("Votre nom"),
  structure: obligatoire("Le nom du cabinet ou de l'entreprise"),
  type: z.enum(["cabinet", "entreprise", "autre"], { error: "Indiquez votre type de structure." }),
  email: emailObligatoire,
  telephone: telephoneFacultatif,
  effectif: facultatif,
  message: z
    .string()
    .trim()
    .max(2000, { error: "Message trop long (2 000 caractères maximum)." })
    .transform((v) => (v === "" ? null : v)),
});

// Activation ou prolongation d'un abonnement par l'administrateur plateforme
export const schemaActivationAbonnement = z.object({
  formule_id: z.uuid({ error: "Choisissez une formule." }),
  fin: z.iso.date({ error: "Indiquez une date de fin valide." }),
});

export const schemaPaiement = z.object({
  duree: z.enum(["1", "12"], { error: "Choisissez une durée." }).transform((d) => (d === "12" ? 12 : 1) as 1 | 12),
  telephone: obligatoire("Le numéro Mobile Money"),
});

export const schemaFormule = z.object({
  libelle: obligatoire("Le nom de la formule"),
  prix_mensuel: z.coerce
    .number({ error: "Indiquez un prix (0 si gratuit)." })
    .int({ error: "Le prix doit être un nombre entier." })
    .min(0, { error: "Le prix ne peut pas être négatif." }),
  description: facultatif,
});

export const schemaProfil = z.object({
  nom_complet: obligatoire("Le nom complet"),
  // Numéro WhatsApp facultatif pour les alertes (« 077 12 34 56 » ou « +241… »)
  whatsapp: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const numero = normaliserTelephoneSalarie(v, "+241");
      if (!numero) ctx.addIssue({ code: "custom", message: "Numéro invalide (exemple : +241 77 12 34 56)." });
      return numero;
    }),
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
