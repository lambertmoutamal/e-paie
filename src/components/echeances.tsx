import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formaterDate } from "@/lib/abonnements/phases";
import { libelleTypeContrat } from "@/lib/contrats/regles";
import { Badge, Carte, EtatVide } from "./ui";

export type Echeance = {
  contrat_id: string;
  entreprise_id: string;
  raison_sociale: string;
  salarie_id: string;
  salarie: string;
  type_contrat: string;
  nature: "fin_contrat" | "fin_essai";
  echeance: string;
  jours_restants: number;
};

function delai(jours: number): { texte: string; teinte: "rouge" | "ambre" | "bleu" } {
  if (jours < 0) return { texte: `Dépassée de ${-jours} j`, teinte: "rouge" };
  if (jours === 0) return { texte: "Aujourd'hui", teinte: "rouge" };
  if (jours <= 7) return { texte: `Dans ${jours} j`, teinte: "ambre" };
  return { texte: `Dans ${jours} j`, teinte: "bleu" };
}

// Fins de contrats à durée déterminée et de périodes d'essai à venir (30 jours).
export function CarteEcheances({ echeances, avecEntreprise }: { echeances: Echeance[]; avecEntreprise?: boolean }) {
  return (
    <Carte titre="Échéances des 30 prochains jours" description="Fins de contrat et fins de période d'essai." sansMarge>
      {!echeances.length ? (
        <EtatVide icone={CalendarClock} titre="Aucune échéance proche" />
      ) : (
        <ul className="divide-y divide-bordure">
          {echeances.map((e) => {
            const d = delai(e.jours_restants);
            return (
              <li key={`${e.contrat_id}-${e.nature}`}>
                <Link
                  href={`/espace/entreprises/${e.entreprise_id}/salaries/${e.salarie_id}/contrats`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/[.02] sm:px-5"
                >
                  <CalendarClock size={18} className="shrink-0 text-marque" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.salarie}</p>
                    <p className="truncate text-sm text-doux">
                      {e.nature === "fin_contrat" ? `Fin de ${libelleTypeContrat(e.type_contrat)}` : "Fin de période d'essai"} le{" "}
                      {formaterDate(e.echeance)}
                      {avecEntreprise ? ` · ${e.raison_sociale}` : ""}
                    </p>
                  </div>
                  <Badge teinte={d.teinte}>{d.texte}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}
