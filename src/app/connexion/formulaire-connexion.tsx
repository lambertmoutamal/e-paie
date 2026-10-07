"use client";

import { useActionState } from "react";
import type { EtatConnexion } from "@/lib/auth/connexion";

type Props = {
  action: (etat: EtatConnexion, formulaire: FormData) => Promise<EtatConnexion>;
};

export function FormulaireConnexion({ action }: Props) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);

  return (
    <form action={envoyer} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={etat?.email}
          className="rounded-lg border border-black/20 bg-white px-3 py-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Mot de passe</span>
        <input
          name="mot_de_passe"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-black/20 bg-white px-3 py-3 text-base"
        />
      </label>

      {etat?.erreur && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="rounded-lg bg-marque px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
