"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Info, LoaderCircle, MessageCircle, Smartphone } from "lucide-react";
import { INDICATIFS, masquerTelephone, type Canal } from "@/lib/portail/regles";
import { classesBouton } from "@/components/ui";
import { demanderCode, verifierCode } from "./actions";

const STYLE_BASE =
  "h-12 rounded-lg border border-bordure bg-surface text-base outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20";
const STYLE_SAISIE = `${STYLE_BASE} w-full px-3`;

// Connexion en deux temps : numéro de téléphone, puis code à 6 chiffres.
export function FormulairePortail() {
  const [etat, envoyer, enCours] = useActionState(demanderCode, undefined);
  const [recommencer, setRecommencer] = useState(0);

  if (etat?.etape === "code" && recommencer === 0) {
    return <SaisieCode key={etat.telephone} etatEnvoi={etat} onAutreNumero={() => setRecommencer(1)} />;
  }

  const saisie = etat?.etape === "telephone" ? etat : undefined;
  return (
    <form action={(f) => { setRecommencer(0); envoyer(f); }} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="telephone" className="text-sm font-medium">
          Votre numéro de téléphone
        </label>
        <div className="flex gap-2">
          <label htmlFor="indicatif" className="sr-only">
            Pays
          </label>
          <select id="indicatif" name="indicatif" defaultValue={saisie?.indicatif ?? "+241"} className={`${STYLE_BASE} w-36 shrink-0 px-2`}>
            {INDICATIFS.map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {valeur} {libelle.split(" (")[0]}
              </option>
            ))}
          </select>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="077 12 34 56"
            required
            defaultValue={saisie?.telephone}
            className={`${STYLE_SAISIE} min-w-0 flex-1`}
          />
        </div>
        <p className="text-xs text-doux">Le numéro que vous avez donné à votre employeur.</p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Recevoir le code par</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["sms", "SMS", Smartphone],
              ["whatsapp", "WhatsApp", MessageCircle],
            ] as const
          ).map(([valeur, libelle, Icone]) => (
            <label
              key={valeur}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-bordure bg-surface text-sm font-medium has-checked:border-marque has-checked:bg-marque-claire has-checked:text-marque"
            >
              <input type="radio" name="canal" value={valeur} defaultChecked={(saisie?.canal ?? "sms") === valeur} className="sr-only" />
              <Icone size={18} aria-hidden />
              {libelle}
            </label>
          ))}
        </div>
      </fieldset>

      {saisie?.erreur && <Alerte texte={saisie.erreur} />}

      <button type="submit" disabled={enCours} className={`${classesBouton("principal")} h-12 w-full`}>
        {enCours && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
        {enCours ? "Envoi du code…" : "Recevoir mon code"}
      </button>
    </form>
  );
}

function SaisieCode({
  etatEnvoi,
  onAutreNumero,
}: {
  etatEnvoi: { telephone: string; canal: Canal; info?: string };
  onAutreNumero: () => void;
}) {
  const [etat, envoyer, enCours] = useActionState(verifierCode.bind(null, etatEnvoi.telephone, etatEnvoi.canal), undefined);
  const erreur = etat?.erreur;

  return (
    <form action={envoyer} className="flex flex-col gap-4" noValidate>
      <p className="flex items-start gap-2 rounded-lg bg-marque-claire px-3 py-2 text-sm text-marque-fonce">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          {etatEnvoi.info ??
            `Si le numéro ${masquerTelephone(etatEnvoi.telephone)} est enregistré par votre employeur, vous allez recevoir un code par ${
              etatEnvoi.canal === "whatsapp" ? "WhatsApp" : "SMS"
            }. Sinon, contactez votre service RH.`}
        </span>
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium">
          Code à 6 chiffres
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={7}
          autoFocus
          required
          className={`${STYLE_SAISIE} text-center text-2xl tracking-[0.5em]`}
        />
      </div>
      {erreur && <Alerte texte={erreur} />}
      <button type="submit" disabled={enCours} className={`${classesBouton("principal")} h-12 w-full`}>
        {enCours && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
        {enCours ? "Vérification…" : "Se connecter"}
      </button>
      <button type="button" onClick={onAutreNumero} className="text-sm font-medium text-marque hover:underline">
        Changer de numéro ou renvoyer un code
      </button>
    </form>
  );
}

function Alerte({ texte }: { texte: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
      {texte}
    </p>
  );
}
