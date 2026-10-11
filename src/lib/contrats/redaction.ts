import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nettoyerHtml, remplirChamps, valeursChamps } from "./document";

const CHAMPS_CONTRAT =
  "id, entreprise_id, salarie_id, contrat_parent_id, nature, type_contrat, poste, categorie, salaire_base, devise, heures_hebdo, lieu_travail, date_debut, date_fin_prevue, fin_periode_essai, objet";

// Texte d'un contrat (ou avenant) préparé à partir d'un modèle : les champs {{…}} sont
// remplis avec les informations de l'entreprise, du salarié et du contrat.
// Lecture avec le client de la personne connectée : la RLS limite à ce qu'elle peut voir.
export async function preparerContenu(supabase: SupabaseClient, contratId: string, modeleId: string | null): Promise<string | null> {
  const { data: contrat } = await supabase.from("contrats").select(CHAMPS_CONTRAT).eq("id", contratId).maybeSingle();
  if (!contrat) return null;

  const [{ data: salarie }, { data: entreprise }, { data: modele }, { data: parent }] = await Promise.all([
    supabase.from("salaries").select("nom, prenoms, sexe, date_naissance, nationalite, adresse, matricule, numero_cnss").eq("id", contrat.salarie_id).maybeSingle(),
    supabase.from("entreprises").select("raison_sociale, adresse, rccm, nif, numero_cnss").eq("id", contrat.entreprise_id).maybeSingle(),
    modeleId
      ? supabase.from("modeles_contrat").select("contenu, entreprise_id").eq("id", modeleId).maybeSingle()
      : Promise.resolve({ data: null }),
    contrat.contrat_parent_id
      ? supabase.from("contrats").select(CHAMPS_CONTRAT).eq("id", contrat.contrat_parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!salarie || !entreprise) return null;
  if (modeleId && (!modele || (modele.entreprise_id !== null && modele.entreprise_id !== contrat.entreprise_id))) return null;

  // Pour un avenant : conditions en vigueur du contrat (déjà mises à jour), date d'effet et objet de l'avenant
  const source = contrat.nature === "avenant" && parent ? { ...parent, date_debut: contrat.date_debut, objet: contrat.objet } : contrat;
  const valeurs = valeursChamps({ entreprise, salarie, contrat: source, aujourdhui: new Date().toISOString().slice(0, 10) });
  return remplirChamps(nettoyerHtml(modele?.contenu ?? "<p></p>"), valeurs);
}
