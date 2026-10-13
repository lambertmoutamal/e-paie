import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bornesMois, libellePeriode, STATUTS_PERIODE, type StatutPeriode } from "@/lib/bulletins/regles";
import { libelleTypeContrat } from "@/lib/contrats/regles";
import { SUJETS_RECLAMATION, STATUTS_RECLAMATION, type StatutReclamation, type SujetReclamation } from "@/lib/reclamations/regles";
import { valeurLiee } from "@/lib/supabase/relations";
import type { CodeEtat } from "./catalogue";

export type Colonne = { cle: string; libelle: string; nombre?: boolean };
export type ResultatEtat = { colonnes: Colonne[]; lignes: Record<string, string | number>[]; total?: Record<string, string | number> };

const date = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "");
const nom = (lie: unknown) => `${valeurLiee(lie, "nom") ?? ""} ${valeurLiee(lie, "prenoms") ?? ""}`.trim();
const arrondi = (n: number) => Math.round(n * 10) / 10;

// Données d'un état, lues avec le client de la personne connectée : la base ne renvoie
// que ce que la personne a le droit de voir dans cette entreprise.
export async function chargerEtat(
  supabase: SupabaseClient,
  code: CodeEtat,
  entrepriseId: string,
  annee: number,
  mois: number,
): Promise<ResultatEtat | null> {
  const { debut, fin } = bornesMois(annee, mois);

  switch (code) {
    case "personnel": {
      const [{ data: salaries }, { data: contrats }] = await Promise.all([
        supabase
          .from("salaries")
          .select("id, matricule, nom, prenoms, sexe, date_naissance, poste, date_embauche, telephone, numero_cnss")
          .eq("entreprise_id", entrepriseId)
          .eq("statut", "actif")
          .order("nom"),
        supabase.from("contrats").select("salarie_id, type_contrat").eq("entreprise_id", entrepriseId).eq("statut", "en_cours").neq("nature", "avenant"),
      ]);
      const typeDe = new Map((contrats ?? []).map((c) => [c.salarie_id, libelleTypeContrat(c.type_contrat)]));
      return {
        colonnes: [
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "sexe", libelle: "Sexe" },
          { cle: "naissance", libelle: "Né(e) le" },
          { cle: "poste", libelle: "Poste" },
          { cle: "contrat", libelle: "Contrat" },
          { cle: "embauche", libelle: "Embauché(e) le" },
          { cle: "telephone", libelle: "Téléphone" },
          { cle: "cnss", libelle: "N° CNSS" },
        ],
        lignes: (salaries ?? []).map((s) => ({
          matricule: s.matricule,
          nom: `${s.nom} ${s.prenoms}`,
          sexe: s.sexe ?? "",
          naissance: date(s.date_naissance),
          poste: s.poste ?? "",
          contrat: typeDe.get(s.id) ?? "",
          embauche: date(s.date_embauche),
          telephone: s.telephone ?? "",
          cnss: s.numero_cnss ?? "",
        })),
      };
    }

    case "entrees-sorties": {
      const { data } = await supabase
        .from("salaries")
        .select("matricule, nom, prenoms, poste, date_embauche, date_sortie, motif_sortie")
        .eq("entreprise_id", entrepriseId)
        .or(`and(date_embauche.gte.${debut},date_embauche.lte.${fin}),and(date_sortie.gte.${debut},date_sortie.lte.${fin})`)
        .order("nom");
      const lignes = (data ?? []).flatMap((s) => [
        ...(s.date_embauche >= debut && s.date_embauche <= fin
          ? [{ mouvement: "Entrée", date: date(s.date_embauche), matricule: s.matricule, nom: `${s.nom} ${s.prenoms}`, poste: s.poste ?? "", motif: "" }]
          : []),
        ...(s.date_sortie && s.date_sortie >= debut && s.date_sortie <= fin
          ? [{ mouvement: "Sortie", date: date(s.date_sortie), matricule: s.matricule, nom: `${s.nom} ${s.prenoms}`, poste: s.poste ?? "", motif: s.motif_sortie ?? "" }]
          : []),
      ]);
      return {
        colonnes: [
          { cle: "mouvement", libelle: "Mouvement" },
          { cle: "date", libelle: "Date" },
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "poste", libelle: "Poste" },
          { cle: "motif", libelle: "Motif de sortie" },
        ],
        lignes,
        total: { mouvement: `${lignes.filter((l) => l.mouvement === "Entrée").length} entrée(s), ${lignes.filter((l) => l.mouvement === "Sortie").length} sortie(s)` },
      };
    }

    case "contrats": {
      const { data } = await supabase
        .from("contrats")
        .select("type_contrat, poste, salaire_base, date_debut, date_fin_prevue, fin_periode_essai, salaries(matricule, nom, prenoms)")
        .eq("entreprise_id", entrepriseId)
        .eq("statut", "en_cours")
        .neq("nature", "avenant")
        .order("date_fin_prevue", { ascending: true, nullsFirst: false });
      return {
        colonnes: [
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "type", libelle: "Contrat" },
          { cle: "poste", libelle: "Poste" },
          { cle: "salaire", libelle: "Salaire de base", nombre: true },
          { cle: "debut", libelle: "Début" },
          { cle: "fin", libelle: "Fin prévue" },
          { cle: "essai", libelle: "Fin d'essai" },
        ],
        lignes: (data ?? []).map((c) => ({
          matricule: valeurLiee(c.salaries, "matricule") ?? "",
          nom: nom(c.salaries),
          type: libelleTypeContrat(c.type_contrat),
          poste: c.poste ?? "",
          salaire: c.salaire_base ?? "",
          debut: date(c.date_debut),
          fin: date(c.date_fin_prevue) || "Indéterminée",
          essai: date(c.fin_periode_essai),
        })),
      };
    }

    case "conges-du-mois": {
      const { data } = await supabase
        .from("demandes_absence")
        .select("debut, fin, nb_jours, saisie_rh, salaries(matricule, nom, prenoms), types_absence(libelle)")
        .eq("entreprise_id", entrepriseId)
        .eq("statut", "acceptee")
        .lte("debut", fin)
        .gte("fin", debut)
        .order("debut");
      const lignes = (data ?? []).map((a) => ({
        matricule: valeurLiee(a.salaries, "matricule") ?? "",
        nom: nom(a.salaries),
        type: valeurLiee(a.types_absence, "libelle") ?? "",
        du: date(a.debut),
        au: date(a.fin),
        jours: Number(a.nb_jours),
        origine: a.saisie_rh ? "Saisie RH" : "Demande du salarié",
      }));
      return {
        colonnes: [
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "type", libelle: "Type" },
          { cle: "du", libelle: "Du" },
          { cle: "au", libelle: "Au" },
          { cle: "jours", libelle: "Jours", nombre: true },
          { cle: "origine", libelle: "Origine" },
        ],
        lignes,
        total: { matricule: "Total", jours: arrondi(lignes.reduce((s, l) => s + l.jours, 0)) },
      };
    }

    case "absences-par-type": {
      const { data } = await supabase
        .from("demandes_absence")
        .select("nb_jours, salarie_id, types_absence(libelle, nature)")
        .eq("entreprise_id", entrepriseId)
        .eq("statut", "acceptee")
        .lte("debut", fin)
        .gte("fin", debut);
      const parType = new Map<string, { jours: number; salaries: Set<string>; nombre: number }>();
      for (const a of data ?? []) {
        const type = valeurLiee(a.types_absence, "libelle") ?? "Autre";
        const x = parType.get(type) ?? { jours: 0, salaries: new Set<string>(), nombre: 0 };
        x.jours += Number(a.nb_jours);
        x.salaries.add(a.salarie_id);
        x.nombre++;
        parType.set(type, x);
      }
      const lignes = [...parType].map(([type, x]) => ({ type, absences: x.nombre, salaries: x.salaries.size, jours: arrondi(x.jours) })).sort((a, b) => b.jours - a.jours);
      return {
        colonnes: [
          { cle: "type", libelle: "Type d'absence" },
          { cle: "absences", libelle: "Absences", nombre: true },
          { cle: "salaries", libelle: "Salariés concernés", nombre: true },
          { cle: "jours", libelle: "Jours", nombre: true },
        ],
        lignes,
        total: { type: "Total", absences: lignes.reduce((s, l) => s + l.absences, 0), jours: arrondi(lignes.reduce((s, l) => s + l.jours, 0)) },
      };
    }

    case "soldes-conges": {
      const [{ data: salaries }, { data: soldes }] = await Promise.all([
        supabase.from("salaries").select("id, matricule, nom, prenoms").eq("entreprise_id", entrepriseId).eq("statut", "actif").order("nom"),
        supabase.rpc("soldes_entreprise", { p_entreprise_id: entrepriseId }),
      ]);
      const soldeDe = new Map(((soldes ?? []) as Record<string, number | string>[]).map((x) => [x.salarie_id as string, x]));
      return {
        colonnes: [
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "depart", libelle: "Solde de départ", nombre: true },
          { cle: "acquis", libelle: "Acquis", nombre: true },
          { cle: "anciennete", libelle: "Ancienneté", nombre: true },
          { cle: "pris", libelle: "Pris", nombre: true },
          { cle: "perdus", libelle: "Perdus", nombre: true },
          { cle: "attente", libelle: "En attente", nombre: true },
          { cle: "disponible", libelle: "Disponible", nombre: true },
        ],
        lignes: (salaries ?? []).map((s) => {
          const x = soldeDe.get(s.id);
          return {
            matricule: s.matricule,
            nom: `${s.nom} ${s.prenoms}`,
            depart: Number(x?.solde_initial ?? 0),
            acquis: Number(x?.acquis ?? 0),
            anciennete: Number(x?.anciennete ?? 0),
            pris: Number(x?.pris ?? 0),
            perdus: Number(x?.perdu ?? 0),
            attente: Number(x?.en_attente ?? 0),
            disponible: Number(x?.disponible ?? 0),
          };
        }),
      };
    }

    case "bulletins": {
      const { data: periode } = await supabase
        .from("periodes_paie")
        .select("id, statut, publiee_le")
        .eq("entreprise_id", entrepriseId)
        .eq("annee", annee)
        .eq("mois", mois)
        .maybeSingle();
      if (!periode) return { colonnes: [{ cle: "info", libelle: "Information" }], lignes: [{ info: `Aucune période de paie pour ${libellePeriode(annee, mois)}.` }] };
      const { data } = await supabase
        .from("bulletins")
        .select("fichier_nom, depose_le, empreinte_sha256, salaries(matricule, nom, prenoms)")
        .eq("periode_id", periode.id)
        .order("depose_le");
      const statut = STATUTS_PERIODE[periode.statut as StatutPeriode].libelle;
      return {
        colonnes: [
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "fichier", libelle: "Fichier" },
          { cle: "depose", libelle: "Déposé le" },
          { cle: "statut", libelle: "Statut de la période" },
          { cle: "publie", libelle: "Publié le" },
          { cle: "empreinte", libelle: "Empreinte (SHA-256)" },
        ],
        lignes: (data ?? []).map((b) => ({
          matricule: valeurLiee(b.salaries, "matricule") ?? "",
          nom: nom(b.salaries),
          fichier: b.fichier_nom,
          depose: date(b.depose_le?.slice(0, 10)),
          statut,
          publie: date(periode.publiee_le?.slice(0, 10)),
          empreinte: b.empreinte_sha256,
        })),
        total: { matricule: `${data?.length ?? 0} bulletin(s)` },
      };
    }

    case "reclamations": {
      const { data } = await supabase
        .from("reclamations")
        .select("objet, sujet, statut, cree_le, resolue_le, salaries(matricule, nom, prenoms)")
        .eq("entreprise_id", entrepriseId)
        .gte("cree_le", `${debut}T00:00:00Z`)
        .lte("cree_le", `${fin}T23:59:59Z`)
        .order("cree_le");
      return {
        colonnes: [
          { cle: "date", libelle: "Ouverte le" },
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "sujet", libelle: "Sujet" },
          { cle: "objet", libelle: "Objet" },
          { cle: "statut", libelle: "Statut" },
          { cle: "resolue", libelle: "Résolue le" },
        ],
        lignes: (data ?? []).map((r) => ({
          date: date(r.cree_le.slice(0, 10)),
          matricule: valeurLiee(r.salaries, "matricule") ?? "",
          nom: nom(r.salaries),
          sujet: SUJETS_RECLAMATION[r.sujet as SujetReclamation].libelle,
          objet: r.objet,
          statut: STATUTS_RECLAMATION[r.statut as StatutReclamation].libelle,
          resolue: date(r.resolue_le?.slice(0, 10)),
        })),
      };
    }

    default:
      return null;
  }
}
