import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Module } from "@/lib/modules";
import { COULEURS_MODULES } from "./couleurs-modules";
import { ICONES_MODULES } from "./icone-module";
import { Badge } from "./ui";

// Tuile d'un module : cliquable, aux couleurs du module, avec son statut (disponible / bientôt).
export function CarteModule({ module, href }: { module: Module; href: string }) {
  const Icone = ICONES_MODULES[module.id];
  const couleur = COULEURS_MODULES[module.id];
  const disponible = module.statut === "disponible";
  return (
    <Link
      href={href}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-surface p-5 transition ${
        disponible ? `border-bordure hover:-translate-y-0.5 hover:shadow-md ${couleur.bordure}` : "border-dashed border-bordure opacity-80"
      }`}
    >
      {disponible && <span className={`absolute inset-x-0 top-0 h-1 ${couleur.plein}`} aria-hidden />}
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-11 place-items-center rounded-xl ${disponible ? `${couleur.fond} ${couleur.texte}` : "bg-black/[.04] text-doux"}`}>
          <Icone size={22} aria-hidden />
        </span>
        {disponible ? <Badge teinte="vert">Disponible</Badge> : <Badge>Bientôt</Badge>}
      </div>
      <div>
        <p className="font-semibold">{module.nom}</p>
        <p className="mt-0.5 text-sm text-doux">{module.accroche}</p>
      </div>
      {disponible && (
        <span className={`mt-auto inline-flex items-center gap-1 text-sm font-semibold ${couleur.texte}`}>
          Ouvrir <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      )}
    </Link>
  );
}
