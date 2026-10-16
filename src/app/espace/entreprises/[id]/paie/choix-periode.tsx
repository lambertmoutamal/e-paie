"use client";

import { use, useId, useState } from "react";
import { CircleAlert } from "lucide-react";
import { ContexteFormulaire } from "@/components/formulaire";
import { NOMS_MOIS } from "@/lib/bulletins/regles";

const STYLE_SAISIE =
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base text-foreground outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20 aria-invalid:border-red-500";

const cle = (annee: number, mois: number) => `${annee}-${String(mois).padStart(2, "0")}`;

// Choix du mois de paie en deux listes : l'année, puis le mois (janvier → décembre).
// Les mois qui ont déjà une période sont grisés. La valeur envoyée reste « AAAA-MM ».
export function ChoixPeriode({
  annees,
  existantes,
  anneeInitiale,
  moisInitial,
}: {
  annees: number[];
  existantes: string[];
  anneeInitiale: number;
  moisInitial: number;
}) {
  const etat = use(ContexteFormulaire);
  const erreur = etat?.erreurs?.periode;
  const id = useId();
  const prises = new Set(existantes);
  const premierLibre = (a: number) => NOMS_MOIS.findIndex((_, i) => !prises.has(cle(a, i + 1))) + 1;

  const [annee, setAnnee] = useState(anneeInitiale);
  const [mois, setMois] = useState(prises.has(cle(anneeInitiale, moisInitial)) ? premierLibre(anneeInitiale) : moisInitial);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-annee`} className="text-sm font-medium">
          Année <span className="text-red-600"> *</span>
        </label>
        <select
          id={`${id}-annee`}
          value={annee}
          onChange={(e) => {
            const a = Number(e.target.value);
            setAnnee(a);
            if (prises.has(cle(a, mois))) setMois(premierLibre(a));
          }}
          className={STYLE_SAISIE}
        >
          {annees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-mois`} className="text-sm font-medium">
          Mois <span className="text-red-600"> *</span>
        </label>
        <select
          id={`${id}-mois`}
          value={mois}
          onChange={(e) => setMois(Number(e.target.value))}
          aria-invalid={erreur ? true : undefined}
          className={STYLE_SAISIE}
        >
          <option value={0} disabled>
            Choisir…
          </option>
          {NOMS_MOIS.map((nom, i) => {
            const deja = prises.has(cle(annee, i + 1));
            return (
              <option key={nom} value={i + 1} disabled={deja}>
                {nom}
                {deja ? " (déjà créée)" : ""}
              </option>
            );
          })}
        </select>
        {erreur && (
          <p className="flex items-center gap-1 text-sm text-red-700">
            <CircleAlert size={14} aria-hidden />
            {erreur}
          </p>
        )}
      </div>
      <input type="hidden" name="periode" value={mois > 0 ? cle(annee, mois) : ""} />
    </>
  );
}
