import Link from "next/link";
import { BellRing, ChevronRight, CircleCheck, Send, Undo2, UserX } from "lucide-react";
import { libellePeriode, libelleRole } from "@/lib/bulletins/regles";
import type { ActionPaie } from "@/lib/bulletins/actions-a-faire";
import { formaterDate } from "@/lib/abonnements/phases";

const APPARENCE = {
  a_valider: { libelle: "À valider", icone: CircleCheck, classes: "bg-amber-100 text-amber-800" },
  a_publier: { libelle: "À publier", icone: Send, classes: "bg-sky-100 text-sky-800" },
  a_corriger: { libelle: "À corriger", icone: Undo2, classes: "bg-red-100 text-red-800" },
  sans_validateur: { libelle: "Rôle à attribuer", icone: UserX, classes: "bg-red-100 text-red-800" },
} as const;

// Carte « À faire » du tableau de bord : très visible, en tête de page.
export function CarteActionsPaie({ actions }: { actions: ActionPaie[] }) {
  return (
    <section id="a-faire" aria-labelledby="titre-a-faire" className="overflow-hidden rounded-xl border-2 border-amber-300 bg-surface shadow-sm">
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-full bg-amber-400 text-white">
          <BellRing size={18} aria-hidden />
        </span>
        <div>
          <h2 id="titre-a-faire" className="font-semibold text-amber-950">
            {actions.length} action{actions.length > 1 ? "s" : ""} de paie vous attend{actions.length > 1 ? "ent" : ""}
          </h2>
          <p className="text-sm text-amber-900/80">Les plus anciennes en premier.</p>
        </div>
      </div>
      <ul className="divide-y divide-bordure">
        {actions.map((a) => {
          const { libelle, icone: Icone, classes } = APPARENCE[a.action];
          return (
            <li key={a.periode_id}>
              <Link
                href={a.action === "sans_validateur" ? `/espace/entreprises/${a.entreprise_id}` : `/espace/entreprises/${a.entreprise_id}/paie/${a.periode_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-black/[.02] sm:px-5">
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>
                  <Icone size={14} aria-hidden />
                  {libelle}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    Paie de {libellePeriode(a.annee, a.mois)} · {a.raison_sociale}
                  </span>
                  <span className="block truncate text-sm text-doux">
                    {a.action === "sans_validateur"
                      ? `Étape « ${a.libelle_etape} » bloquée : personne n'a le rôle « ${libelleRole(a.commentaire ?? "")} » · `
                      : a.action === "a_valider"
                        ? `Étape « ${a.libelle_etape} » · `
                        : ""}
                    depuis le {formaterDate(a.depuis)}
                    {a.commentaire && a.action !== "sans_validateur" ? ` · motif du refus : « ${a.commentaire} »` : ""}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-doux" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Bandeau affiché en haut de toutes les pages de l'espace.
export function BandeauActionsPaie({ nombre }: { nombre: number }) {
  return (
    <Link
      href="/espace#a-faire"
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
    >
      <BellRing size={16} className="shrink-0 text-amber-600" aria-hidden />
      {nombre} action{nombre > 1 ? "s" : ""} de paie vous attend{nombre > 1 ? "ent" : ""} — voir
      <ChevronRight size={16} aria-hidden />
    </Link>
  );
}
