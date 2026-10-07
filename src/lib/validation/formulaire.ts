import type { z } from "zod";

// État renvoyé par une action de formulaire et affiché par la page.
export type EtatFormulaire =
  | {
      erreurs?: Record<string, string>;
      erreur?: string;
      succes?: string;
      valeurs?: Record<string, string>;
      // Affiché une seule fois quand un compte vient d'être créé.
      compteCree?: { email: string; motDePasse: string };
    }
  | undefined;

type Resultat<T> =
  | { ok: true; donnees: T; valeurs: Record<string, string> }
  | { ok: false; erreurs: Record<string, string>; valeurs: Record<string, string> };

// Lit les champs texte d'un formulaire et les vérifie avec un schéma.
// En cas d'erreur, on renvoie un message par champ et les valeurs saisies
// (pour ne pas obliger l'utilisateur à tout retaper).
export function lireFormulaire<S extends z.ZodType>(
  schema: S,
  formulaire: FormData,
): Resultat<z.output<S>> {
  const valeurs: Record<string, string> = {};
  for (const [cle, valeur] of formulaire.entries()) {
    if (typeof valeur === "string" && !cle.startsWith("$")) valeurs[cle] = valeur;
  }

  const resultat = schema.safeParse(valeurs);
  if (resultat.success) return { ok: true, donnees: resultat.data, valeurs };

  const erreurs: Record<string, string> = {};
  for (const probleme of resultat.error.issues) {
    const champ = String(probleme.path[0] ?? "_");
    erreurs[champ] ??= probleme.message;
  }
  return { ok: false, erreurs, valeurs };
}
