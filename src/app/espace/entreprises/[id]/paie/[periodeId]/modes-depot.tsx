"use client";

import { useState, type ComponentProps } from "react";
import { FileStack, Files } from "lucide-react";
import { DecoupageLot } from "./decoupage-lot";
import { DepotEnMasse } from "./depot-bulletins";

const MODES = [
  { id: "lot", libelle: "Un seul PDF avec tous les bulletins", icone: FileStack },
  { id: "fichiers", libelle: "Un PDF par salarié", icone: Files },
] as const;

// Choix du mode de dépôt en masse.
export function ModesDepot(props: ComponentProps<typeof DepotEnMasse>) {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("lot");
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Mode de dépôt" className="flex flex-wrap gap-1 rounded-lg bg-black/[.04] p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === m.id ? "bg-surface text-marque shadow-sm" : "text-doux hover:text-foreground"
            }`}
          >
            <m.icone size={16} aria-hidden />
            {m.libelle}
          </button>
        ))}
      </div>
      {mode === "lot" ? <DecoupageLot {...props} /> : <DepotEnMasse {...props} />}
    </div>
  );
}
