"use client";

import { useActionState } from "react";
import { FileDown, LoaderCircle, Save } from "lucide-react";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { EditeurDocument } from "@/components/editeur-document";
import { MessageEtat } from "@/components/formulaire";
import { classesBouton } from "@/components/ui";

// Rédaction du contrat d'un salarié : enregistrer, ou enregistrer et générer le PDF.
export function FormulaireDocument({
  action,
  contenu,
}: {
  action: (etat: EtatFormulaire, formulaire: FormData) => Promise<EtatFormulaire>;
  contenu: string;
}) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <EditeurDocument contenuInitial={contenu} avecChamps />
      <MessageEtat etat={etat} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" name="decision" value="enregistrer" disabled={enCours} className={classesBouton("secondaire")}>
          <Save size={16} aria-hidden />
          Enregistrer
        </button>
        <button type="submit" name="decision" value="pdf" disabled={enCours} className={classesBouton()}>
          {enCours ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <FileDown size={16} aria-hidden />}
          Enregistrer et générer le PDF
        </button>
      </div>
    </form>
  );
}
