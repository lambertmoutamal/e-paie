"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { CATEGORIES_MODELE, TYPES_CONTRAT } from "@/lib/contrats/regles";
import { EditeurDocument } from "@/components/editeur-document";
import { MessageEtat } from "@/components/formulaire";
import { classesBouton } from "@/components/ui";

const STYLE =
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base outline-none focus:border-marque focus:ring-2 focus:ring-marque/20 aria-invalid:border-red-500";

// Création ou modification d'un modèle : nom, catégorie, type conseillé et texte.
export function FormulaireModele({
  action,
  initial,
  libelleBouton,
}: {
  action: (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;
  initial: { nom: string; categorie: string; type_contrat: string | null; contenu: string };
  libelleBouton: string;
}) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  const e = etat?.erreurs ?? {};
  return (
    <form action={envoyer} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 sm:col-span-3">
          <span className="text-sm font-medium">
            Nom du modèle <span className="text-red-600">*</span>
          </span>
          <input name="nom" defaultValue={etat?.valeurs?.nom ?? initial.nom} maxLength={120} aria-invalid={e.nom ? true : undefined} className={STYLE} />
          {e.nom && <span className="text-sm text-red-700">{e.nom}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Catégorie</span>
          <select name="categorie" defaultValue={initial.categorie} className={STYLE}>
            {Object.entries(CATEGORIES_MODELE).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Type de contrat conseillé</span>
          <select name="type_contrat" defaultValue={initial.type_contrat ?? ""} className={STYLE}>
            <option value="">Tous types</option>
            {Object.entries(TYPES_CONTRAT).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-doux">
        Utilisez <strong>« + Insérer un champ »</strong> pour placer les informations remplies automatiquement (nom, poste, salaire…). Vous pouvez
        aussi importer votre propre modèle Word.
      </p>
      <EditeurDocument contenuInitial={initial.contenu} avecChamps avecImportWord />
      <MessageEtat etat={etat} />
      <div className="flex justify-end">
        <button type="submit" disabled={enCours} className={classesBouton()}>
          {enCours && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
          {enCours ? "Enregistrement…" : libelleBouton}
        </button>
      </div>
    </form>
  );
}
