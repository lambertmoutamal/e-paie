import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bornesMois, libellePeriode, STATUTS_PERIODE, type StatutPeriode } from "@/lib/bulletins/regles";
import { libelleTypeContrat } from "@/lib/contrats/regles";
import { SUJETS_RECLAMATION, STATUTS_RECLAMATION, type StatutReclamation, type SujetReclamation } from "@/lib/reclamations/regles";
import { valeurLiee } from "@/lib/supabase/relations";
import type { CodeEtat } from "./catalogue";

export type Colonne = { cle: string; libelle: string; nombre?: boolean };
export type ResultatEtat = {
  colonnes: Colonne[];
  lignes: Record<string, string | number>[];
  total?: Record<string, string | number>;
  // Liens complémentaires affichés sous le tableau (ex. reçus pour solde de tout compte)
  liens?: { libelle: string; href: string }[];
  remarque?: string;
};

// Colonnes des résultats de paie importés (livre de paie)
const COLONNES_PAIE: Colonne[] = [
  { cle: "jours_travailles", libelle: "Jours", nombre: true },
  { cle: "salaire_base", libelle: "Salaire de base", nombre: true },
  { cle: "heures_sup", libelle: "Heures sup.", nombre: true },
  { cle: "primes", libelle: "Primes", nombre: true },
  { cle: "avantages_nature", libelle: "Avantages en nature", nombre: true },
  { cle: "brut", libelle: "Brut", nombre: true },
  { cle: "brut_imposable", libelle: "Brut imposable", nombre: true },
  { cle: "cnss_salarie", libelle: "CNSS salarié", nombre: true },
  { cle: "cnamgs_salarie", libelle: "CNAMGS salarié", nombre: true },
  { cle: "impot_revenu", libelle: "IRPP / ITS", nombre: true },
  { cle: "autres_retenues", libelle: "Autres retenues", nombre: true },
  { cle: "net_a_payer", libelle: "Net à payer", nombre: true },
  { cle: "cnss_employeur", libelle: "CNSS employeur", nombre: true },
  { cle: "cnamgs_employeur", libelle: "CNAMGS employeur", nombre: true },
  { cle: "autres_charges_employeur", libelle: "Autres charges patronales", nombre: true },
  { cle: "cout_total", libelle: "Coût total employeur", nombre: true },
];
const CHAMPS_PAIE =
  "jours_travailles, salaire_base, heures_sup, primes, avantages_nature, brut, brut_imposable, cnss_salarie, cnamgs_salarie, impot_revenu, autres_retenues, net_a_payer, cnss_employeur, cnamgs_employeur, autres_charges_employeur, rubriques";
const SANS_RESULTATS = "Aucun résultat de paie importé pour cette sélection : importez l'Excel du logiciel de paie depuis la période de paie (Paie → Périodes et bulletins → Résultats de paie).";

type LignePaie = Record<string, unknown> & { rubriques?: Record<string, number> | null };
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// Totaux des colonnes chiffrées
function totaliser(colonnes: Colonne[], lignes: Record<string, string | number>[], libelle: string) {
  const total: Record<string, string | number> = { [colonnes[0].cle]: libelle };
  for (const c of colonnes) if (c.nombre) total[c.cle] = lignes.reduce((s, l) => s + (typeof l[c.cle] === "number" ? (l[c.cle] as number) : 0), 0);
  return total;
}

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

    case "livre-de-paie": {
      const { data: periode } = await supabase.from("periodes_paie").select("id").eq("entreprise_id", entrepriseId).eq("annee", annee).eq("mois", mois).maybeSingle();
      const { data } = periode
        ? await supabase.from("resultats_paie").select(`${CHAMPS_PAIE}, salaries(matricule, nom, prenoms)`).eq("periode_id", periode.id)
        : { data: [] as LignePaie[] };
      const resultats = (data ?? []) as LignePaie[];
      // Les autres colonnes du fichier (rubriques) s'ajoutent à droite
      const rubriques = [...new Set(resultats.flatMap((r) => Object.keys(r.rubriques ?? {})))].sort((a, b) => a.localeCompare(b, "fr"));
      const colonnes: Colonne[] = [
        { cle: "matricule", libelle: "Matricule" },
        { cle: "nom", libelle: "Nom et prénoms" },
        ...COLONNES_PAIE,
        ...rubriques.map((r) => ({ cle: `rub:${r}`, libelle: r, nombre: true })),
      ];
      const lignes = resultats
        .map((r) => {
          const ligne: Record<string, string | number> = { matricule: valeurLiee(r.salaries, "matricule") ?? "", nom: nom(r.salaries) };
          for (const c of COLONNES_PAIE) if (c.cle !== "cout_total" && r[c.cle] !== null && r[c.cle] !== undefined) ligne[c.cle] = n(r[c.cle]);
          ligne.cout_total = n(r.brut) + n(r.cnss_employeur) + n(r.cnamgs_employeur) + n(r.autres_charges_employeur);
          for (const k of rubriques) if (r.rubriques?.[k] !== undefined) ligne[`rub:${k}`] = Number(r.rubriques[k]);
          return ligne;
        })
        .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
      return { colonnes, lignes, total: lignes.length ? totaliser(colonnes, lignes, "Total") : undefined, remarque: lignes.length ? undefined : SANS_RESULTATS };
    }

    case "solde-tout-compte": {
      const { data: sortis } = await supabase
        .from("salaries")
        .select("id, matricule, nom, prenoms, date_sortie, motif_sortie")
        .eq("entreprise_id", entrepriseId)
        .gte("date_sortie", debut)
        .lte("date_sortie", fin)
        .order("date_sortie");
      const { data: periode } = await supabase.from("periodes_paie").select("id").eq("entreprise_id", entrepriseId).eq("annee", annee).eq("mois", mois).maybeSingle();
      const ids = (sortis ?? []).map((x) => x.id);
      const { data: resultats } =
        periode && ids.length
          ? await supabase.from("resultats_paie").select("salarie_id, brut, net_a_payer, rubriques").eq("periode_id", periode.id).in("salarie_id", ids)
          : { data: [] as { salarie_id: string; brut: number | null; net_a_payer: number | null; rubriques: Record<string, number> | null }[] };
      const resultatDe = new Map((resultats ?? []).map((r) => [r.salarie_id, r]));
      const lignes = (sortis ?? []).map((x) => {
        const r = resultatDe.get(x.id);
        return {
          matricule: x.matricule,
          nom: `${x.nom} ${x.prenoms}`,
          sortie: date(x.date_sortie),
          motif: x.motif_sortie ?? "",
          brut: r ? n(r.brut) : "",
          net: r ? n(r.net_a_payer) : "Non importé",
        };
      });
      return {
        colonnes: [
          { cle: "matricule", libelle: "Matricule" },
          { cle: "nom", libelle: "Nom et prénoms" },
          { cle: "sortie", libelle: "Date de sortie" },
          { cle: "motif", libelle: "Motif" },
          { cle: "brut", libelle: "Brut du mois", nombre: true },
          { cle: "net", libelle: "Net versé (solde de tout compte)", nombre: true },
        ],
        lignes,
        liens: (sortis ?? [])
          .filter((x) => resultatDe.has(x.id))
          .map((x) => ({ libelle: `Reçu pour solde de tout compte — ${x.nom} ${x.prenoms}`, href: `/espace/etats/solde-tout-compte/recu?entreprise=${entrepriseId}&salarie=${x.id}&mois=${annee}-${String(mois).padStart(2, "0")}` })),
        remarque: lignes.length ? undefined : "Aucun salarié sorti ce mois-ci.",
      };
    }

    case "dts":
    case "das": {
      const { data } = await supabase
        .from("resultats_paie")
        .select(`${CHAMPS_PAIE}, salarie_id, periodes_paie!inner(annee, mois), salaries(matricule, nom, prenoms, numero_cnss)`)
        .eq("entreprise_id", entrepriseId)
        .eq("periodes_paie.annee", annee);
      // Cumuls de l'année par salarié
      const parSalarie = new Map<string, { salarie: unknown; mois: Set<number>; sommes: Record<string, number> }>();
      for (const r of (data ?? []) as LignePaie[]) {
        const id = String(r.salarie_id);
        const x = parSalarie.get(id) ?? { salarie: r.salaries, mois: new Set<number>(), sommes: {} };
        x.mois.add(Number(valeurLiee(r.periodes_paie, "mois")));
        for (const c of COLONNES_PAIE) if (c.cle !== "cout_total") x.sommes[c.cle] = (x.sommes[c.cle] ?? 0) + n(r[c.cle]);
        parSalarie.set(id, x);
      }
      const base = (x: { salarie: unknown; mois: Set<number> }) => ({
        matricule: valeurLiee(x.salarie, "matricule") ?? "",
        cnss: valeurLiee(x.salarie, "numero_cnss") ?? "",
        nom: nom(x.salarie),
        mois: x.mois.size,
      });
      const colonnes: Colonne[] =
        code === "dts"
          ? [
              { cle: "matricule", libelle: "Matricule" },
              { cle: "nom", libelle: "Nom et prénoms" },
              { cle: "mois", libelle: "Mois payés", nombre: true },
              { cle: "brut", libelle: "Brut annuel", nombre: true },
              { cle: "avantages_nature", libelle: "Avantages en nature", nombre: true },
              { cle: "brut_imposable", libelle: "Brut imposable annuel", nombre: true },
              { cle: "impot_revenu", libelle: "IRPP / ITS retenu", nombre: true },
              { cle: "net_a_payer", libelle: "Net annuel versé", nombre: true },
            ]
          : [
              { cle: "matricule", libelle: "Matricule" },
              { cle: "cnss", libelle: "N° CNSS" },
              { cle: "nom", libelle: "Nom et prénoms" },
              { cle: "mois", libelle: "Mois payés", nombre: true },
              { cle: "brut", libelle: "Salaire brut annuel", nombre: true },
              { cle: "cnss_salarie", libelle: "CNSS salarié", nombre: true },
              { cle: "cnss_employeur", libelle: "CNSS employeur", nombre: true },
              { cle: "cnamgs_salarie", libelle: "CNAMGS salarié", nombre: true },
              { cle: "cnamgs_employeur", libelle: "CNAMGS employeur", nombre: true },
            ];
      const lignes = [...parSalarie.values()]
        .map((x) => {
          const ligne: Record<string, string | number> = base(x);
          for (const c of colonnes) if (c.nombre && c.cle !== "mois") ligne[c.cle] = Math.round((x.sommes[c.cle] ?? 0) * 100) / 100;
          return ligne;
        })
        .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
      return {
        colonnes,
        lignes,
        total: lignes.length ? totaliser(colonnes, lignes, "Total") : undefined,
        remarque: lignes.length
          ? "Présentation générique des cumuls annuels : elle sera adaptée au formulaire officiel dès réception du modèle."
          : `Aucun résultat de paie importé pour ${annee}.`,
      };
    }

    default:
      return null;
  }
}
