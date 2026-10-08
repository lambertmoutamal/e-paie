import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Search, UserPlus, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { Badge, Carte, classesBouton, EnTetePage, EtatVide, LienBouton, Ligne, ListeLignes, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Salariés" };

const PAR_PAGE = 50;

export default async function PageSalaries({ params, searchParams }: PageProps<"/espace/entreprises/[id]/salaries">) {
  const { id } = await params;
  const { q, statut, page } = await searchParams;
  const recherche = typeof q === "string" ? q.trim().slice(0, 60) : "";
  const filtre = statut === "sorti" || statut === "tous" ? statut : "actif";
  const numeroPage = Math.max(1, Number(page) || 1);
  const { supabase } = await exigerUtilisateur();

  const { data: entreprise } = await supabase.from("entreprises").select("id, raison_sociale").eq("id", id).maybeSingle();
  if (!entreprise) notFound();

  let requete = supabase
    .from("salaries")
    .select("id, matricule, nom, prenoms, poste, date_embauche, statut, date_sortie, telephone", { count: "exact" })
    .eq("entreprise_id", id)
    .order("nom")
    .order("prenoms")
    .range((numeroPage - 1) * PAR_PAGE, numeroPage * PAR_PAGE - 1);
  if (filtre !== "tous") requete = requete.eq("statut", filtre);
  if (recherche) {
    // Les caractères spéciaux sont neutralisés pour ne pas perturber le filtre.
    const motif = `%${recherche.replace(/[%_,()\\]/g, " ")}%`;
    requete = requete.or(`nom.ilike.${motif},prenoms.ilike.${motif},matricule.ilike.${motif}`);
  }
  const [{ data: salaries, count }, { data: peutGerer }] = await Promise.all([
    requete,
    supabase.rpc("peut_gerer_salaries", { p_entreprise_id: id }),
  ]);
  const total = count ?? 0;
  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const lien = (changements: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(recherche && { q: recherche }), statut: filtre, ...Object.fromEntries(Object.entries(changements).map(([k, v]) => [k, String(v)])) });
    return `/espace/entreprises/${id}/salaries?${p}`;
  };

  return (
    <Page>
      <EnTetePage
        titre="Salariés"
        description={entreprise.raison_sociale}
        fil={[
          { href: "/espace/entreprises", libelle: "Entreprises" },
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
        ]}
        actions={
          peutGerer === true && (
            <>
              <LienBouton href={`/espace/entreprises/${id}/salaries/importer`} variante="secondaire" icone={FileSpreadsheet}>
                Importer depuis Excel
              </LienBouton>
              <LienBouton href={`/espace/entreprises/${id}/salaries/nouveau`} icone={UserPlus}>
                Ajouter un salarié
              </LienBouton>
            </>
          )
        }
      />

      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-doux" aria-hidden />
          <input
            name="q"
            defaultValue={recherche}
            placeholder="Nom, prénom ou matricule"
            className="h-11 w-full rounded-lg border border-bordure bg-surface pl-9 pr-3 outline-none focus:border-marque focus:ring-2 focus:ring-marque/20"
          />
        </label>
        <select
          name="statut"
          defaultValue={filtre}
          aria-label="Statut"
          className="h-11 rounded-lg border border-bordure bg-surface px-3 outline-none focus:border-marque"
        >
          <option value="actif">En poste</option>
          <option value="sorti">Sortis</option>
          <option value="tous">Tous</option>
        </select>
        <button type="submit" className={classesBouton("secondaire")}>
          Rechercher
        </button>
      </form>

      <Carte titre={`${total} salarié${total > 1 ? "s" : ""}`} sansMarge>
        {!salaries?.length ? (
          <EtatVide
            icone={Users}
            titre={recherche ? "Aucun résultat" : "Aucun salarié"}
            texte={recherche ? "Essayez avec un autre nom ou matricule." : peutGerer ? "Ajoutez vos salariés un par un ou importez-les depuis Excel." : undefined}
          />
        ) : (
          <ListeLignes>
            {salaries.map((s) => (
              <Ligne
                key={s.id}
                href={`/espace/entreprises/${id}/salaries/${s.id}`}
                titre={`${s.nom} ${s.prenoms}`}
                sousTitre={[`Matricule ${s.matricule}`, s.poste, `embauché(e) le ${formaterDate(s.date_embauche)}`].filter(Boolean).join(" · ")}
                fin={s.statut === "sorti" ? <Badge>Sorti(e) le {formaterDate(s.date_sortie!)}</Badge> : !s.telephone ? <Badge teinte="ambre">Sans téléphone</Badge> : null}
              />
            ))}
          </ListeLignes>
        )}
      </Carte>

      {nbPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-sm">
          {numeroPage > 1 && (
            <Link href={lien({ page: numeroPage - 1 })} className={classesBouton("secondaire", "petit")}>
              ← Précédente
            </Link>
          )}
          <span className="text-doux">
            Page {numeroPage} / {nbPages}
          </span>
          {numeroPage < nbPages && (
            <Link href={lien({ page: numeroPage + 1 })} className={classesBouton("secondaire", "petit")}>
              Suivante →
            </Link>
          )}
        </nav>
      )}
    </Page>
  );
}
