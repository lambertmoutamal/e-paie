"use client";

import { useActionState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import type { EtatConnexion } from "@/lib/auth/connexion";
import { classesBouton } from "@/components/ui";

type Props = {
  action: (etat: EtatConnexion, formulaire: FormData) => Promise<EtatConnexion>;
};

const STYLE_SAISIE =
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20";

export function FormulaireConnexion({ action }: Props) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);

  return (
    <form action={envoyer} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={etat?.email}
          className={STYLE_SAISIE}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Mot de passe</span>
        <input name="mot_de_passe" type="password" autoComplete="current-password" required className={STYLE_SAISIE} />
      </label>

      {etat?.erreur && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {etat.erreur}
        </p>
      )}

      <button type="submit" disabled={enCours} className={`${classesBouton("principal")} mt-2 w-full`}>
        {enCours && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
