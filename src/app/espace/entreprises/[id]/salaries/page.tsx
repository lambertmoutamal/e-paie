import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Search, UserPlus, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { Badge, classesBouton, EnTetePage, EtatVide, LienBouton, Page } from "@/components/ui";
import { Pastilles, Tableau } from "@/components/tableau";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Salariés" };

const PAR_PAGE = 50;

export default async function PageSalaries({ params, searchParams }: PageProps<"/espace/entreprises/[id]/salaries">) {
  await connection(); // page calculée à chaque visite (elle lit la date du jour)
  const { id } = await params;
  const { q, statut, page } = await searchParams;
  const recherche = typeof q === "string" ? q.trim().slice(0, 60) : "";
  const filtre = statut === "sorti" || statut === "tous" || statut === "a_venir" ? statut : "actif";
  const aujourdhui = new Date().toISOString().slice(0, 10);
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
  // « En poste » : embauche passée ; « À venir » : salariés prévisionnels (embauche future)
  if (filtre === "actif") requete = requete.eq("statut", "actif").lte("date_embauche", aujourdhui);
  if (filtre === "a_venir") requete = requete.eq("statut", "actif").gt("date_embauche", aujourdhui);
  if (filtre === "sorti") requete = requete.eq("statut", "sorti");
  if (recherche) {
    // Les caractères spéciaux sont neutralisés pour ne pas perturber le filtre.
    const motif = `%${recherche.replace(/[%_*,"()\\]/g, " ")}%`;
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

  const lienStatut = (s: string) => {
    const p = new URLSearchParams({ ...(recherche && { q: recherche }), statut: s });
    return `/espace/entreprises/${id}/salaries?${p}`;
  };
  const etat = (s: { statut: string; date_embauche: string; date_sortie: string | null; telephone: string | null }) =>
    s.statut === "sorti" ? (
      <Badge>Sorti(e) le {formaterDate(s.date_sortie!)}</Badge>
    ) : s.date_embauche > aujourdhui ? (
      <Badge teinte="bleu">Arrive le {formaterDate(s.date_embauche)}</Badge>
    ) : !s.telephone ? (
      <Badge teinte="ambre">Sans téléphone</Badge>
    ) : (
      <Badge teinte="succes">En poste</Badge>
    );

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
        <input type="hidden" name="statut" value={filtre} />
        <button type="submit" className={classesBouton("secondaire")}>
          Rechercher
        </button>
      </form>

      <Pastilles
        libelle="Filtrer par statut"
        elements={[
          { href: lienStatut("actif"), libelle: "En poste", actif: filtre === "actif" },
          { href: lienStatut("a_venir"), libelle: "À venir", actif: filtre === "a_venir" },
          { href: lienStatut("sorti"), libelle: "Sortis", actif: filtre === "sorti" },
          { href: lienStatut("tous"), libelle: "Tous", actif: filtre === "tous" },
        ]}
      />

      <h2 className="text-base font-semibold" aria-live="polite">
        {total} salarié{total > 1 ? "s" : ""}
      </h2>

      {!salaries?.length ? (
        <div className="rounded-2xl border border-bordure bg-surface shadow-carte">
          <EtatVide
            icone={Users}
            titre={recherche ? "Aucun résultat" : "Aucun salarié"}
            texte={recherche ? "Essayez avec un autre nom ou matricule." : peutGerer ? "Ajoutez vos salariés un par un ou importez-les depuis Excel." : undefined}
            action={
              peutGerer === true && !recherche ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <LienBouton href={`/espace/entreprises/${id}/salaries/nouveau`} icone={UserPlus}>
                    Ajouter un salarié
                  </LienBouton>
                  <LienBouton href={`/espace/entreprises/${id}/salaries/importer`} variante="secondaire" icone={FileSpreadsheet}>
                    Importer depuis Excel
                  </LienBouton>
                </div>
              ) : recherche ? (
                <LienBouton href={lienStatut("tous").replace(/q=[^&]*&?/, "")} variante="secondaire">
                  Effacer la recherche
                </LienBouton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <Tableau
          legende="Liste des salariés"
          lignes={salaries}
          cleLigne={(s) => s.id}
          hrefLigne={(s) => `/espace/entreprises/${id}/salaries/${s.id}`}
          colonnes={[
            { cle: "nom", titre: "Nom", principale: true, rendu: (s) => `${s.nom} ${s.prenoms}` },
            { cle: "matricule", titre: "Matricule", rendu: (s) => s.matricule },
            { cle: "poste", titre: "Poste", rendu: (s) => s.poste },
            { cle: "embauche", titre: "Embauché(e) le", rendu: (s) => formaterDate(s.date_embauche) },
            { cle: "statut", titre: "Statut", statut: true, rendu: (s) => etat(s) },
          ]}
        />
      )}

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
