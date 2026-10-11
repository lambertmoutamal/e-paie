import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Module } from "@/lib/modules";
import { ICONES_MODULES } from "./icone-module";
import { Badge } from "./ui";

// Tuile d'un module : cliquable, avec son statut (disponible / bientôt).
export function CarteModule({ module, href }: { module: Module; href: string }) {
  const Icone = ICONES_MODULES[module.id];
  const disponible = module.statut === "disponible";
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-xl border bg-surface p-4 transition ${
        disponible ? "border-bordure hover:border-marque/50 hover:shadow-sm" : "border-dashed border-bordure"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`grid size-10 place-items-center rounded-lg ${disponible ? "bg-marque-claire text-marque" : "bg-black/[.04] text-doux"}`}
        >
          <Icone size={20} aria-hidden />
        </span>
        {disponible ? <Badge teinte="vert">Disponible</Badge> : <Badge>Bientôt</Badge>}
      </div>
      <div>
        <p className="font-semibold">{module.nom}</p>
        <p className="mt-0.5 text-sm text-doux">{module.accroche}</p>
      </div>
      {disponible && (
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-marque">
          Ouvrir <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      )}
    </Link>
  );
}
