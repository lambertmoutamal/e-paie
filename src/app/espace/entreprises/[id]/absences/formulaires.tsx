"use client";

import { useActionState, useId } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { MessageEtat } from "@/components/formulaire";
import { classesBouton } from "@/components/ui";

type Action = (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;

const STYLE_TEXTE =
  "w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-base outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20 aria-invalid:border-red-500";

// Accepter ou refuser une demande (le refus exige un commentaire).
export function DecisionDemande({ action }: { action: Action }) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  const id = useId();
  if (etat?.succes) return <MessageEtat etat={etat} />;
  return (
    <form action={envoyer} className="flex flex-col gap-2" noValidate>
      <label htmlFor={id} className="sr-only">
        Commentaire
      </label>
      <textarea
        id={id}
        name="commentaire"
        rows={2}
        maxLength={500}
        placeholder="Commentaire (obligatoire en cas de refus)"
        defaultValue={etat?.valeurs?.commentaire}
        aria-invalid={etat?.erreurs?.commentaire ? true : undefined}
        className={STYLE_TEXTE}
      />
      {etat?.erreurs?.commentaire && <p className="text-sm text-red-700">{etat.erreurs.commentaire}</p>}
      <MessageEtat etat={etat} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" name="decision" value="refuser" disabled={enCours} className={classesBouton("danger", "petit")}>
          <X size={14} aria-hidden />
          Refuser
        </button>
        <button type="submit" name="decision" value="accepter" disabled={enCours} className={classesBouton("principal", "petit")}>
          {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
          Accepter
        </button>
      </div>
    </form>
  );
}

// Annulation d'une absence déjà acceptée (motif obligatoire), dans un volet repliable.
export function AnnulationAbsence({ action }: { action: Action }) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  if (etat?.succes) return <MessageEtat etat={etat} />;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-red-700 hover:underline">Annuler l&apos;absence</summary>
      <form action={envoyer} className="mt-2 flex flex-col gap-2" noValidate>
        <textarea name="commentaire" rows={2} maxLength={500} placeholder="Motif de l'annulation" className={STYLE_TEXTE} />
        <MessageEtat etat={etat} />
        <button type="submit" disabled={enCours} className={`${classesBouton("danger", "petit")} self-end`}>
          {enCours && <LoaderCircle size={14} className="animate-spin" aria-hidden />}
          Confirmer l&apos;annulation
        </button>
      </form>
    </details>
  );
}
