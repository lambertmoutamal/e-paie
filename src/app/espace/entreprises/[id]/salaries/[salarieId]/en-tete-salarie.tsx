import Link from "next/link";
import { formaterDate } from "@/lib/abonnements/phases";
import { Badge, EnTetePage } from "@/components/ui";

type Onglet = "fiche" | "contrats" | "documents";

// En-tête commun aux pages du dossier salarié, avec ses onglets.
export function EnTeteSalarie({
  entrepriseId,
  raisonSociale,
  salarie,
  onglet,
}: {
  entrepriseId: string;
  raisonSociale: string;
  salarie: { id: string; nom: string; prenoms: string; matricule: string; poste: string | null; statut: string; date_sortie: string | null; date_embauche: string };
  onglet: Onglet;
}) {
  const base = `/espace/entreprises/${entrepriseId}/salaries/${salarie.id}`;
  const aVenir = salarie.statut === "actif" && salarie.date_embauche > new Date().toISOString().slice(0, 10);
  const onglets: { cle: Onglet; libelle: string; href: string }[] = [
    { cle: "fiche", libelle: "Fiche", href: base },
    { cle: "contrats", libelle: "Contrats", href: `${base}/contrats` },
    { cle: "documents", libelle: "Documents", href: `${base}/documents` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre={`${salarie.nom} ${salarie.prenoms}`}
        description={`Matricule ${salarie.matricule}${salarie.poste ? ` · ${salarie.poste}` : ""}`}
        fil={[
          { href: `/espace/entreprises/${entrepriseId}`, libelle: raisonSociale },
          { href: `/espace/entreprises/${entrepriseId}/salaries`, libelle: "Salariés" },
        ]}
        actions={
          salarie.statut === "sorti" ? (
            <Badge>Sorti(e) le {formaterDate(salarie.date_sortie!)}</Badge>
          ) : aVenir ? (
            <Badge teinte="bleu">Arrive le {formaterDate(salarie.date_embauche)}</Badge>
          ) : (
            <Badge teinte="vert">En poste</Badge>
          )
        }
      />
      <nav aria-label="Dossier du salarié" className="flex gap-1 border-b border-bordure">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={o.href}
            aria-current={o.cle === onglet ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              o.cle === onglet ? "border-marque text-marque" : "border-transparent text-doux hover:text-foreground"
            }`}
          >
            {o.libelle}
          </Link>
        ))}
      </nav>
    </div>
  );
}
