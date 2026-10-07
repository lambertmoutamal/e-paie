"use client";

import { createContext, use, useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { classesBouton } from "./ui";

type Action = (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;

const ContexteFormulaire = createContext<EtatFormulaire>(undefined);

// Formulaire relié à une action serveur : affiche les erreurs par champ
// et le message de réussite.
export function Formulaire({
  action,
  libelleBouton,
  colonnes = 1,
  children,
}: {
  action: Action;
  libelleBouton: string;
  colonnes?: 1 | 2;
  children: ReactNode;
}) {
  const [etat, envoyer] = useActionState(action, undefined);

  return (
    <ContexteFormulaire value={etat}>
      <form action={envoyer} className="flex flex-col gap-5" noValidate>
        <div className={`grid gap-4 ${colonnes === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
        <MessageEtat etat={etat} />
        <div className="flex justify-end">
          <BoutonEnvoyer>{libelleBouton}</BoutonEnvoyer>
        </div>
      </form>
    </ContexteFormulaire>
  );
}

const STYLE_SAISIE =
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base text-foreground shadow-[inset_0_1px_1px_rgba(0,0,0,.03)] outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20 disabled:bg-black/[.03] disabled:text-doux aria-invalid:border-red-500 aria-invalid:ring-red-100";

function Etiquette({ id, libelle, requis }: { id: string; libelle: string; requis?: boolean }) {
  return (
    <label htmlFor={id} className="text-sm font-medium">
      {libelle}
      {requis && <span className="text-red-600"> *</span>}
    </label>
  );
}

function MessageChamp({ id, erreur, aide }: { id: string; erreur?: string; aide?: string }) {
  if (erreur) {
    return (
      <p id={`${id}-message`} className="flex items-center gap-1 text-sm text-red-700">
        <CircleAlert size={14} aria-hidden />
        {erreur}
      </p>
    );
  }
  return aide ? <p id={`${id}-message`} className="text-xs text-doux">{aide}</p> : null;
}

type ProprietesChamp = {
  nom: string;
  libelle: string;
  type?: "text" | "email" | "tel" | "password";
  valeurInitiale?: string | null;
  requis?: boolean;
  aide?: string;
  autoComplete?: string;
  desactive?: boolean;
  pleineLargeur?: boolean;
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
  pleineLargeur,
}: ProprietesChamp) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  // Identifiant unique sur la page, même si deux formulaires ont un champ du même nom.
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${pleineLargeur ? "sm:col-span-2" : ""}`}>
      <Etiquette id={id} libelle={libelle} requis={requis} />
      <input
        id={id}
        name={nom}
        type={type}
        defaultValue={etat?.valeurs?.[nom] ?? valeurInitiale ?? ""}
        autoComplete={autoComplete}
        inputMode={type === "email" ? "email" : type === "tel" ? "tel" : undefined}
        disabled={desactive}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur || aide ? `${id}-message` : undefined}
        className={STYLE_SAISIE}
      />
      <MessageChamp id={id} erreur={erreur} aide={aide} />
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
  aide,
  pleineLargeur,
}: {
  nom: string;
  libelle: string;
  options: { valeur: string; libelle: string }[];
  valeurInitiale?: string | null;
  requis?: boolean;
  desactive?: boolean;
  aide?: string;
  pleineLargeur?: boolean;
}) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${pleineLargeur ? "sm:col-span-2" : ""}`}>
      <Etiquette id={id} libelle={libelle} requis={requis} />
      <select
        id={id}
        name={nom}
        defaultValue={etat?.valeurs?.[nom] ?? valeurInitiale ?? ""}
        disabled={desactive}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur || aide ? `${id}-message` : undefined}
        className={STYLE_SAISIE}
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
      <MessageChamp id={id} erreur={erreur} aide={aide} />
    </div>
  );
}

// Choix exclusif présenté sous forme de cartes (ex. « Cabinet » / « Entreprise »).
export function ChoixCartes({
  nom,
  libelle,
  options,
  valeurInitiale,
}: {
  nom: string;
  libelle: string;
  options: { valeur: string; titre: string; texte: string }[];
  valeurInitiale?: string;
}) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const choisie = etat?.valeurs?.[nom] ?? valeurInitiale;
  const id = useId();

  return (
    <fieldset className="flex flex-col gap-1.5 sm:col-span-2" aria-describedby={erreur ? `${id}-message` : undefined}>
      <legend className="mb-1.5 text-sm font-medium">{libelle}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.valeur}
            className="flex cursor-pointer gap-3 rounded-xl border border-bordure bg-surface p-4 transition has-[:checked]:border-marque has-[:checked]:bg-marque-claire/50 has-[:checked]:ring-1 has-[:checked]:ring-marque"
          >
            <input type="radio" name={nom} value={o.valeur} defaultChecked={choisie === o.valeur} className="mt-1 accent-[var(--marque)]" />
            <span>
              <span className="block font-semibold">{o.titre}</span>
              <span className="block text-sm text-doux">{o.texte}</span>
            </span>
          </label>
        ))}
      </div>
      <MessageChamp id={id} erreur={erreur} />
    </fieldset>
  );
}

export function CaseACocher({ nom, children }: { nom: string; children: ReactNode }) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const id = useId();
  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          name={nom}
          defaultChecked={etat?.valeurs?.[nom] === "on"}
          aria-invalid={erreur ? true : undefined}
          className="mt-0.5 size-4 accent-[var(--marque)]"
        />
        <span>{children}</span>
      </label>
      <MessageChamp id={id} erreur={erreur} />
    </div>
  );
}

export function TitreGroupe({ children }: { children: ReactNode }) {
  return <p className="pt-2 text-sm font-semibold text-doux sm:col-span-2">{children}</p>;
}

function BoutonEnvoyer({ children, variante = "principal" }: { children: ReactNode; variante?: "principal" | "secondaire" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={classesBouton(variante)}>
      {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
      {pending ? "Enregistrement…" : children}
    </button>
  );
}

export function MessageEtat({ etat }: { etat: EtatFormulaire }) {
  if (!etat) return null;
  return (
    <>
      {etat.erreur && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-marque/20 bg-marque-claire px-3 py-2 text-sm text-marque-fonce">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {etat.succes}
        </p>
      )}
    </>
  );
}

// Petit bouton d'action (ex. « Renvoyer l'invitation ») avec son résultat juste à côté.
export function ActionEnLigne({
  action,
  libelle,
  variante = "secondaire",
}: {
  action: (etat: EtatFormulaire) => Promise<EtatFormulaire>;
  libelle: string;
  variante?: "secondaire" | "danger" | "discret";
}) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  return (
    <form action={envoyer} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={enCours} className={classesBouton(variante, "petit")}>
        {enCours && <LoaderCircle size={14} className="animate-spin" aria-hidden />}
        {libelle}
      </button>
      {etat?.erreur && <p className="max-w-56 text-right text-xs text-red-700">{etat.erreur}</p>}
      {etat?.succes && <p className="max-w-56 text-right text-xs text-marque">{etat.succes}</p>}
    </form>
  );
}
