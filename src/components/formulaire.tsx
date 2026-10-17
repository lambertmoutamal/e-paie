"use client";

import { createContext, use, useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { classesBouton } from "./ui";

type Action = (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;

export const ContexteFormulaire = createContext<EtatFormulaire>(undefined);

// Formulaire relié à une action serveur : affiche les erreurs par champ
// et le message de réussite.
export function Formulaire({
  action,
  libelleBouton,
  colonnes = 1,
  boutonEnHaut,
  children,
}: {
  action: Action;
  libelleBouton: string;
  colonnes?: 1 | 2;
  // Formulaire long : le bouton d'envoi est aussi affiché en haut
  boutonEnHaut?: boolean;
  children: ReactNode;
}) {
  const [etat, envoyer] = useActionState(action, undefined);

  return (
    <ContexteFormulaire value={etat}>
      <form action={envoyer} className="flex flex-col gap-5" noValidate>
        {boutonEnHaut && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-bordure pb-4">
            {etat?.succes && <span className="text-sm text-marque">{etat.succes}</span>}
            <BoutonEnvoyer>{libelleBouton}</BoutonEnvoyer>
          </div>
        )}
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
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base text-foreground shadow-[inset_0_1px_1px_rgba(0,0,0,.03)] outline-none transition placeholder:text-doux/70 hover:border-marque/40 focus:border-marque focus:ring-2 focus:ring-marque/20 disabled:cursor-not-allowed disabled:bg-black/[.03] disabled:text-doux aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-100";

function Etiquette({ id, libelle, requis }: { id: string; libelle: string; requis?: boolean }) {
  return (
    <label htmlFor={id} className="text-sm font-semibold">
      {libelle}
      {requis && <span className="text-red-700" aria-hidden> *</span>}
    </label>
  );
}

function MessageChamp({ id, erreur, aide }: { id: string; erreur?: string; aide?: string }) {
  if (erreur) {
    return (
      <p id={`${id}-message`} className="flex items-start gap-1 text-sm font-medium text-red-700">
        <CircleAlert size={14} className="mt-1 shrink-0" aria-hidden />
        {erreur}
      </p>
    );
  }
  return aide ? <p id={`${id}-message`} className="text-xs text-doux">{aide}</p> : null;
}

type ProprietesChamp = {
  nom: string;
  libelle: string;
  type?: "text" | "email" | "tel" | "password" | "date";
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
      <legend className="mb-1.5 text-sm font-semibold">{libelle}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.valeur}
            className="flex min-h-16 cursor-pointer gap-3 rounded-xl border border-bordure bg-surface p-4 transition hover:border-marque/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marque has-[:checked]:border-marque has-[:checked]:bg-marque-claire/50 has-[:checked]:ring-1 has-[:checked]:ring-marque"
          >
            <input type="radio" name={nom} value={o.valeur} defaultChecked={choisie === o.valeur} className="mt-0.5 size-5 shrink-0 accent-[var(--marque)]" />
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

export function CaseACocher({ nom, children, coche }: { nom: string; children: ReactNode; coche?: boolean }) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const id = useId();
  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-sm">
        <input
          id={id}
          type="checkbox"
          name={nom}
          defaultChecked={etat?.valeurs ? etat.valeurs[nom] === "on" : coche}
          aria-invalid={erreur ? true : undefined}
          className="size-5 shrink-0 accent-[var(--marque)]"
        />
        <span>{children}</span>
      </label>
      <MessageChamp id={id} erreur={erreur} />
    </div>
  );
}

export function ZoneTexte({ nom, libelle, aide, max = 2000 }: { nom: string; libelle: string; aide?: string; max?: number }) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.[nom];
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {libelle}
      </label>
      <textarea
        id={id}
        name={nom}
        rows={4}
        maxLength={max}
        defaultValue={etat?.valeurs?.[nom] ?? ""}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur || aide ? `${id}-message` : undefined}
        className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-base outline-none transition hover:border-marque/40 aria-invalid:border-red-500 focus:border-marque focus:ring-2 focus:ring-marque/20"
      />
      <MessageChamp id={id} erreur={erreur} aide={aide} />
    </div>
  );
}

// Envoi d'un fichier (PDF ou photo). Le champ s'appelle toujours « fichier ».
export function ChampFichier({ libelle, requis, aide }: { libelle: string; requis?: boolean; aide?: string }) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.fichier;
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Etiquette id={id} libelle={libelle} requis={requis} />
      <input
        id={id}
        name="fichier"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        aria-invalid={erreur ? true : undefined}
        aria-describedby={`${id}-message`}
        className="block w-full rounded-lg border border-bordure bg-surface text-sm file:mr-3 file:h-11 file:cursor-pointer file:border-0 file:bg-marque-claire file:px-4 file:font-semibold file:text-marque"
      />
      <MessageChamp id={id} erreur={erreur} aide={aide ?? "PDF, JPEG ou PNG, 4 Mo maximum. Sur téléphone, vous pouvez prendre une photo."} />
    </div>
  );
}

export function TitreGroupe({ children }: { children: ReactNode }) {
  return <p className="border-b border-bordure pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-doux sm:col-span-2">{children}</p>;
}

export function BoutonEnvoyer({ children, variante = "principal" }: { children: ReactNode; variante?: "principal" | "secondaire" }) {
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
