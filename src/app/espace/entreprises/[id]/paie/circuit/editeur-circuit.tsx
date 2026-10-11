"use client";

import { useActionState, useId, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { MAX_ETAPES, ROLES_CIRCUIT, type EtapeCircuit } from "@/lib/bulletins/regles";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { MessageEtat } from "@/components/formulaire";
import { classesBouton } from "@/components/ui";

const STYLE_SAISIE =
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20 aria-invalid:border-red-500";

type Ligne = EtapeCircuit & { cle: number };

// Édition des étapes du circuit : ajout, suppression, changement d'ordre.
export function EditeurCircuit({
  action,
  initial,
}: {
  action: (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;
  initial: EtapeCircuit[];
}) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  const [etapes, setEtapes] = useState<Ligne[]>(() => initial.map((e, i) => ({ ...e, cle: i })));
  const [prochaineCle, setProchaineCle] = useState(initial.length);
  const id = useId();

  const modifier = (cle: number, champ: Partial<EtapeCircuit>) => setEtapes((l) => l.map((e) => (e.cle === cle ? { ...e, ...champ } : e)));
  const deplacer = (index: number, sens: -1 | 1) =>
    setEtapes((l) => {
      const copie = [...l];
      [copie[index], copie[index + sens]] = [copie[index + sens], copie[index]];
      return copie;
    });

  return (
    <form action={envoyer} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="nombre" value={etapes.length} />
      <ol className="flex flex-col gap-3">
        {etapes.map((e, i) => {
          const n = i + 1;
          const erreurLibelle = etat?.erreurs?.[`libelle_${n}`];
          const erreurRole = etat?.erreurs?.[`role_${n}`];
          return (
            <li key={e.cle} className="flex flex-col gap-3 rounded-xl border border-bordure p-3 sm:flex-row sm:items-start">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-marque-claire font-bold text-marque" aria-hidden>
                {n}
              </span>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-l${e.cle}`} className="text-sm font-medium">
                    Nom de l&apos;étape {n}
                  </label>
                  <input
                    id={`${id}-l${e.cle}`}
                    name={`libelle_${n}`}
                    value={e.libelle}
                    maxLength={60}
                    placeholder="Exemple : Contrôle"
                    onChange={(ev) => modifier(e.cle, { libelle: ev.target.value })}
                    aria-invalid={erreurLibelle ? true : undefined}
                    className={STYLE_SAISIE}
                  />
                  {erreurLibelle && <p className="text-sm text-red-700">{erreurLibelle}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-r${e.cle}`} className="text-sm font-medium">
                    Validée par
                  </label>
                  <select
                    id={`${id}-r${e.cle}`}
                    name={`role_${n}`}
                    value={e.role}
                    onChange={(ev) => modifier(e.cle, { role: ev.target.value as EtapeCircuit["role"] })}
                    aria-invalid={erreurRole ? true : undefined}
                    className={STYLE_SAISIE}
                  >
                    {Object.entries(ROLES_CIRCUIT).map(([valeur, libelle]) => (
                      <option key={valeur} value={valeur}>
                        {libelle}
                      </option>
                    ))}
                  </select>
                  {erreurRole && <p className="text-sm text-red-700">{erreurRole}</p>}
                </div>
              </div>
              <div className="flex gap-1 sm:pt-6">
                <button type="button" className={classesBouton("secondaire", "petit")} disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label={`Monter l'étape ${n}`}>
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={classesBouton("secondaire", "petit")}
                  disabled={i === etapes.length - 1}
                  onClick={() => deplacer(i, 1)}
                  aria-label={`Descendre l'étape ${n}`}
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={classesBouton("danger", "petit")}
                  disabled={etapes.length === 1}
                  onClick={() => setEtapes((l) => l.filter((x) => x.cle !== e.cle))}
                  aria-label={`Supprimer l'étape ${n}`}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {etapes.length < MAX_ETAPES && (
        <button
          type="button"
          className={`${classesBouton("discret")} self-start`}
          onClick={() => {
            setEtapes((l) => [...l, { libelle: "", role: "signataire", cle: prochaineCle }]);
            setProchaineCle((c) => c + 1);
          }}
        >
          <Plus size={16} aria-hidden />
          Ajouter une étape
        </button>
      )}

      <MessageEtat etat={etat} />
      <div className="flex justify-end">
        <button type="submit" disabled={enCours} className={classesBouton()}>
          {enCours && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
          {enCours ? "Enregistrement…" : "Enregistrer le circuit"}
        </button>
      </div>
    </form>
  );
}
