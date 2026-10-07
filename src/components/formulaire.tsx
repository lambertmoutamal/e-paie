"use client";

import { createContext, use, useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { EtatFormulaire } from "@/lib/validation/formulaire";

type Action = (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;

const ContexteFormulaire = createContext<EtatFormulaire>(undefined);

// Formulaire relié à une action serveur : affiche les erreurs par champ,
// le message de réussite et, le cas échéant, le mot de passe provisoire.
export function Formulaire({
  action,
  libelleBouton,
  children,
}: {
  action: Action;
  libelleBouton: string;
  children: ReactNode;
}) {
  const [etat, envoyer] = useActionState(action, undefined);

  return (
    <ContexteFormulaire value={etat}>
      <form action={envoyer} className="flex flex-col gap-4" noValidate>
        {children}
        <MessageEtat etat={etat} />
        <BoutonEnvoyer>{libelleBouton}</BoutonEnvoyer>
      </form>
    </ContexteFormulaire>
  );
}

const STYLE_SAISIE =
  "w-full rounded-lg border bg-white px-3 py-3 text-base disabled:bg-black/5 aria-invalid:border-red-600";

type ProprietesChamp = {
  nom: string;
  libelle: string;
  type?: "text" | "email" | "tel" | "password";
  valeurInitiale?: string | null;
  requis?: boolean;
  aide?: string;
  autoComplete?: string;
  desactive?: boolean;
};

export function Champ({
  nom,
  libelle,
  type = "text",
  valeurInitiale,
  requis,
  aide,
  autoComplete,
  desactive,
}: ProprietesChamp) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const id = `champ-${nom}`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {libelle}
        {requis && <span className="text-red-700"> *</span>}
      </label>
      <input
        id={id}
        name={nom}
        type={type}
        defaultValue={etat?.valeurs?.[nom] ?? valeurInitiale ?? ""}
        autoComplete={autoComplete}
        inputMode={type === "email" ? "email" : type === "tel" ? "tel" : undefined}
        disabled={desactive}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className={`${STYLE_SAISIE} border-black/20`}
      />
      {aide && !erreur && <p className="text-xs text-foreground/60">{aide}</p>}
      {erreur && (
        <p id={`${id}-erreur`} className="text-sm text-red-700">
          {erreur}
        </p>
      )}
    </div>
  );
}

export function ChoixListe({
  nom,
  libelle,
  options,
  valeurInitiale,
  requis,
  desactive,
}: {
  nom: string;
  libelle: string;
  options: { valeur: string; libelle: string }[];
  valeurInitiale?: string | null;
  requis?: boolean;
  desactive?: boolean;
}) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const id = `champ-${nom}`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {libelle}
        {requis && <span className="text-red-700"> *</span>}
      </label>
      <select
        id={id}
        name={nom}
        defaultValue={etat?.valeurs?.[nom] ?? valeurInitiale ?? ""}
        disabled={desactive}
        aria-invalid={erreur ? true : undefined}
        className={`${STYLE_SAISIE} border-black/20`}
      >
        <option value="" disabled>
          Choisir…
        </option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
    </div>
  );
}

function BoutonEnvoyer({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-marque px-4 py-3 font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Enregistrement…" : children}
    </button>
  );
}

export function MessageEtat({ etat }: { etat: EtatFormulaire }) {
  if (!etat) return null;
  return (
    <>
      {etat.erreur && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="rounded-lg bg-marque-claire px-3 py-2 text-sm text-marque">
          {etat.succes}
        </p>
      )}
      {etat.compteCree && (
        <div role="status" className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm">
          <p className="font-semibold">Compte créé pour {etat.compteCree.email}</p>
          <p className="mt-1">Mot de passe provisoire :</p>
          <p className="my-2 select-all rounded bg-white px-3 py-2 text-center font-mono text-lg tracking-wider">
            {etat.compteCree.motDePasse}
          </p>
          <p>
            Notez-le et transmettez-le à la personne de façon sûre (en main propre ou par
            téléphone). <strong>Il ne sera plus jamais affiché.</strong> Elle devra le changer à
            sa première connexion.
          </p>
        </div>
      )}
    </>
  );
}
