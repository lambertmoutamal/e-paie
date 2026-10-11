"use client";

import { useActionState, useId } from "react";
import { Check, LoaderCircle, Undo2 } from "lucide-react";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { MessageEtat } from "@/components/formulaire";
import { classesBouton } from "@/components/ui";

// Valider ou refuser l'étape en cours. Le commentaire est facultatif pour valider,
// obligatoire pour refuser (vérifié aussi par le serveur et la base).
export function DecisionEtape({
  action,
  libelleEtape,
  derniere,
}: {
  action: (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;
  libelleEtape: string;
  derniere: boolean;
}) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  const id = useId();
  const erreur = etat?.erreurs?.commentaire;

  return (
    <form action={envoyer} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          Commentaire <span className="font-normal text-doux">(obligatoire en cas de refus)</span>
        </label>
        <textarea
          id={id}
          name="commentaire"
          rows={3}
          maxLength={1000}
          defaultValue={etat?.valeurs?.commentaire}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `${id}-message` : undefined}
          className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-base outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20 aria-invalid:border-red-500"
        />
        {erreur && (
          <p id={`${id}-message`} className="text-sm text-red-700">
            {erreur}
          </p>
        )}
      </div>
      <MessageEtat etat={etat} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" name="decision" value="refuser" disabled={enCours} className={classesBouton("danger")}>
          <Undo2 size={16} aria-hidden />
          Refuser
        </button>
        <button type="submit" name="decision" value="valider" disabled={enCours} className={classesBouton()}>
          {enCours ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
          {derniere ? `Valider « ${libelleEtape} » et approuver` : `Valider « ${libelleEtape} »`}
        </button>
      </div>
    </form>
  );
}
