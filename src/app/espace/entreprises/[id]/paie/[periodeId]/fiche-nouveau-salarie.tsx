"use client";

import { LIBELLES_FICHE, type FicheLue } from "@/lib/bulletins/extraction-fiche";
import { MODES_PAIEMENT } from "@/lib/salaries/regles";

// Fiche proposée pour un salarié absent, lue sur son bulletin : toutes les valeurs restent
// modifiables avant la création (texte ; dates au format AAAA-MM-JJ).
export type FicheProposee = Record<keyof FicheLue, string>;

const OBLIGATOIRES: (keyof FicheLue)[] = ["matricule", "nom", "prenoms", "date_embauche"];
const DATES = new Set<keyof FicheLue>(["date_naissance", "date_embauche", "date_fin_contrat", "date_sortie"]);
const CHOIX: Partial<Record<keyof FicheLue, { valeur: string; libelle: string }[]>> = {
  sexe: [
    { valeur: "F", libelle: "Féminin" },
    { valeur: "M", libelle: "Masculin" },
  ],
  mode_paiement: Object.entries(MODES_PAIEMENT).map(([valeur, libelle]) => ({ valeur, libelle })),
  type_contrat: [
    { valeur: "cdi", libelle: "CDI" },
    { valeur: "cdd", libelle: "CDD" },
    { valeur: "stage", libelle: "Stage" },
    { valeur: "apprentissage", libelle: "Apprentissage" },
    { valeur: "temporaire", libelle: "Temporaire" },
  ],
};

export function ficheProposee(lue: FicheLue): FicheProposee {
  return Object.fromEntries(Object.entries(lue).map(([cle, v]) => [cle, v ?? ""])) as FicheProposee;
}

// Champs obligatoires encore vides (le salarié ne peut pas être créé sans eux)
export function champsManquants(f: FicheProposee): string[] {
  return OBLIGATOIRES.filter((c) => !f[c].trim()).map((c) => LIBELLES_FICHE[c]);
}

export function FicheNouveauSalarie({ fiche, onChange, desactive }: { fiche: FicheProposee; onChange: (f: FicheProposee) => void; desactive?: boolean }) {
  const champs = Object.keys(LIBELLES_FICHE) as (keyof FicheLue)[];
  return (
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {champs.map((c) => {
        const id = `fiche-${c}-${fiche.matricule}`;
        const commun = {
          id,
          value: fiche[c],
          disabled: desactive,
          onChange: (e: { target: { value: string } }) => onChange({ ...fiche, [c]: e.target.value }),
          className: `h-9 w-full rounded-lg border bg-surface px-2 text-sm ${OBLIGATOIRES.includes(c) && !fiche[c].trim() ? "border-red-400" : "border-bordure"}`,
        };
        return (
          <label key={c} htmlFor={id} className="flex flex-col gap-1 text-xs font-medium text-doux">
            <span>
              {LIBELLES_FICHE[c]}
              {OBLIGATOIRES.includes(c) && <span className="text-red-600"> *</span>}
            </span>
            {CHOIX[c] ? (
              <select {...commun}>
                <option value="">—</option>
                {CHOIX[c].map((o) => (
                  <option key={o.valeur} value={o.valeur}>
                    {o.libelle}
                  </option>
                ))}
              </select>
            ) : (
              <input {...commun} type={DATES.has(c) ? "date" : "text"} />
            )}
          </label>
        );
      })}
    </div>
  );
}
