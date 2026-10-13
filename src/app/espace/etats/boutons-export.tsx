"use client";

import { useState } from "react";
import { FileSpreadsheet, LoaderCircle, Printer } from "lucide-react";
import writeExcelFile from "write-excel-file/browser";
import { classesBouton } from "@/components/ui";

type Colonne = { cle: string; libelle: string; nombre?: boolean };

// Export de l'état en Excel et impression (« Enregistrer en PDF » dans la fenêtre d'impression).
export function BoutonsExport({
  nomFichier,
  titre,
  colonnes,
  lignes,
  total,
}: {
  nomFichier: string;
  titre: string;
  colonnes: Colonne[];
  lignes: Record<string, string | number>[];
  total?: Record<string, string | number>;
}) {
  const [enCours, setEnCours] = useState(false);

  async function exporter() {
    setEnCours(true);
    try {
      const entetes = colonnes.map((c) => ({ value: c.libelle, fontWeight: "bold" as const, backgroundColor: "#EEF0FF" }));
      const cellule = (ligne: Record<string, string | number>, c: Colonne) => {
        const v = ligne[c.cle];
        if (v === undefined || v === "") return null;
        return typeof v === "number" ? { value: v, type: Number } : { value: String(v) };
      };
      const donnees = [
        [{ value: titre, fontWeight: "bold" as const }],
        [],
        entetes,
        ...lignes.map((l) => colonnes.map((c) => cellule(l, c))),
        ...(total ? [colonnes.map((c) => ({ ...(cellule(total, c) ?? { value: "" }), fontWeight: "bold" as const }))] : []),
      ];
      // Tableau de lignes (cellules vides = null) : format attendu par write-excel-file
      await writeExcelFile(donnees as never, {
        columns: colonnes.map((c) => ({ width: Math.max(12, c.libelle.length + 4) })),
      }).toFile(`${nomFichier}.xlsx`);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={exporter} disabled={enCours || !lignes.length} className={classesBouton("secondaire", "petit")}>
        {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <FileSpreadsheet size={14} className="text-emerald-600" aria-hidden />}
        Excel
      </button>
      <button type="button" onClick={() => window.print()} disabled={!lignes.length} className={classesBouton("secondaire", "petit")}>
        <Printer size={14} className="text-accent" aria-hidden />
        Imprimer / PDF
      </button>
    </div>
  );
}

// Bouton « Imprimer » seul (reçus, documents à signer)
export function BoutonImprimer({ libelle = "Imprimer" }: { libelle?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${classesBouton("principal", "petit")} print:hidden`}>
      <Printer size={14} aria-hidden />
      {libelle}
    </button>
  );
}
