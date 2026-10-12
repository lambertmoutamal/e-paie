import type { IdModule } from "@/lib/modules";

// Une couleur par module, pour se repérer d'un coup d'œil (tuiles, icônes, en-têtes).
export const COULEURS_MODULES: Record<IdModule, { fond: string; texte: string; plein: string; bordure: string }> = {
  administration: { fond: "bg-sky-50", texte: "text-sky-700", plein: "bg-sky-500", bordure: "hover:border-sky-300" },
  bulletins: { fond: "bg-indigo-50", texte: "text-indigo-700", plein: "bg-indigo-500", bordure: "hover:border-indigo-300" },
  absences: { fond: "bg-emerald-50", texte: "text-emerald-700", plein: "bg-emerald-500", bordure: "hover:border-emerald-300" },
  "self-service": { fond: "bg-rose-50", texte: "text-rose-700", plein: "bg-rose-500", bordure: "hover:border-rose-300" },
  "notes-de-frais": { fond: "bg-amber-50", texte: "text-amber-700", plein: "bg-amber-500", bordure: "hover:border-amber-300" },
  pilotage: { fond: "bg-violet-50", texte: "text-violet-700", plein: "bg-violet-500", bordure: "hover:border-violet-300" },
  paie: { fond: "bg-orange-50", texte: "text-orange-700", plein: "bg-orange-500", bordure: "hover:border-orange-300" },
};
