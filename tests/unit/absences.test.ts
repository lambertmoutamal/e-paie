import { describe, expect, test } from "vitest";
import { formaterJours, libelleDates, schemaDemande, schemaModeValidation, schemaModifTypeAbsence, schemaPrevision, schemaParametresConges, schemaReglesDemandes, schemaSoldeInitial, schemaTypeAbsence } from "@/lib/absences/regles";
import { contenuDecision, contenuNouvelleDemande } from "@/lib/notifications/messages-absences";

const TYPE = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("demande d'absence", () => {
  test("lit une demande valide avec demi-journée", () => {
    const r = schemaDemande.parse({ type_id: TYPE, debut: "2026-11-02", fin: "2026-11-06", debut_apres_midi: "on", motif: "  Vacances " });
    expect(r).toEqual({ type_id: TYPE, debut: "2026-11-02", fin: "2026-11-06", debut_apres_midi: true, fin_midi: false, motif: "Vacances" });
  });

  test("refuse une fin avant le début, ou matin + après-midi sur un seul jour", () => {
    expect(schemaDemande.safeParse({ type_id: TYPE, debut: "2026-11-06", fin: "2026-11-02" }).success).toBe(false);
    const r = schemaDemande.safeParse({ type_id: TYPE, debut: "2026-11-02", fin: "2026-11-02", debut_apres_midi: "on", fin_midi: "on" });
    expect(r.success).toBe(false);
    expect(schemaDemande.safeParse({ type_id: "x", debut: "2026-11-02", fin: "2026-11-02" }).success).toBe(false);
  });
});

describe("réglages et soldes", () => {
  test("accepte la virgule décimale et contrôle les bornes", () => {
    expect(schemaSoldeInitial.parse({ date_reference: "2026-10-01", jours: "12,5" }).jours).toBe(12.5);
    expect(schemaParametresConges.parse({ jours_par_mois: "2,5", decompte: "ouvres" })).toEqual({
      jours_par_mois: 2.5,
      decompte: "ouvres",
      anciennete_tranche_ans: null,
      anciennete_jours_par_tranche: 0,
      anciennete_plafond: null,
    });
    expect(schemaParametresConges.safeParse({ jours_par_mois: "9", decompte: "ouvres" }).success).toBe(false);
    expect(schemaTypeAbsence.parse({ libelle: "Formation", nature: "autre", jours_max: "", demandable: "on" })).toMatchObject({
      jours_max: null,
      demandable: true,
      deduit_solde: false,
    });
  });
});

describe("affichage", () => {
  test("jours et dates en français", () => {
    expect(formaterJours(1)).toBe("1 jour");
    expect(formaterJours("4.5")).toBe("4,5 jours");
    expect(libelleDates({ debut: "2026-11-02", fin: "2026-11-02", fin_midi: true })).toBe("le 2 nov. 2026 (matin)");
    expect(libelleDates({ debut: "2026-11-02", fin: "2026-11-06", debut_apres_midi: true })).toBe("du 2 nov. 2026 (après-midi) au 6 nov. 2026");
  });
});

describe("alertes de congés", () => {
  const base = { debut: "2026-11-02", fin: "2026-11-06", nb_jours: "5", lien: "https://e-paie.example/x" };
  test("nouvelle demande : le RH sait qui, quoi, quand", () => {
    const c = contenuNouvelleDemande({ ...base, nom: "Marie OBIANG", salarie: "NDONG Awa", type: "Congé payé", entreprise: "SOGEA" });
    expect(c.sujet).toBe("Demande d'absence à traiter : NDONG Awa — SOGEA");
    expect(c.whatsapp).toContain("Bonjour Marie");
    expect(c.whatsapp).toContain("du 2 nov. 2026 au 6 nov. 2026 (5 jours)");
  });

  test("décision : le salarié reçoit la réponse et le motif", () => {
    const c = contenuDecision({ ...base, prenoms: "Awa", type: "Congé payé", entreprise: "SOGEA", statut: "refusee", commentaire: "Période de clôture" });
    expect(c.sujet).toBe("Votre demande d'absence a été refusée");
    expect(c.whatsapp).toContain("« Période de clôture »");
    expect(c.variables["3"]).toBe(base.lien);
  });
});

describe("congé prévisionnel", () => {
  test("salarié, type et dates obligatoires, fin après le début", () => {
    const base = { salarie_id: TYPE, type_id: TYPE, debut: "2026-12-21", fin: "2026-12-31" };
    expect(schemaPrevision.parse(base)).toEqual({ ...base, motif: null });
    expect(schemaPrevision.safeParse({ ...base, fin: "2026-12-01" }).success).toBe(false);
    expect(schemaPrevision.safeParse({ ...base, salarie_id: "" }).success).toBe(false);
  });
});

describe("réglages personnalisés des congés", () => {
  test("ancienneté, règles des demandes et mode de validation", () => {
    expect(schemaParametresConges.parse({ jours_par_mois: "2", decompte: "ouvrables", anciennete_tranche_ans: "5", anciennete_jours_par_tranche: "1", anciennete_plafond: "" })).toMatchObject({
      anciennete_tranche_ans: 5,
      anciennete_jours_par_tranche: 1,
      anciennete_plafond: null,
    });
    expect(schemaParametresConges.safeParse({ jours_par_mois: "2", decompte: "ouvrables", anciennete_tranche_ans: "2,5" }).success).toBe(false);
    expect(schemaReglesDemandes.parse({ delai_prevenance_jours: "15", report_max_jours: "10", mois_debut_reference: "6" })).toEqual({
      delai_prevenance_jours: 15,
      solde_negatif_autorise: false,
      report_max_jours: 10,
      mois_debut_reference: 6,
    });
    expect(schemaModeValidation.safeParse({ validation_absences: "rh_puis_administrateur" }).success).toBe(true);
    expect(schemaModeValidation.safeParse({ validation_absences: "personne" }).success).toBe(false);
    expect(schemaModifTypeAbsence.parse({ libelle: "Mariage", jours_max: "4", demandable: "on" })).toEqual({
      libelle: "Mariage",
      jours_max: 4,
      deduit_solde: false,
      justificatif_requis: false,
      demandable: true,
    });
  });
});

describe("dernier congé saisi avec le solde de départ", () => {
  test("facultatif, et la fin doit suivre le début", () => {
    expect(schemaSoldeInitial.parse({ date_reference: "2026-10-01", jours: "10" })).toMatchObject({ dernier_conge_debut: null, dernier_conge_fin: null });
    expect(schemaSoldeInitial.parse({ date_reference: "2026-10-01", jours: "10", dernier_conge_debut: "2026-07-01", dernier_conge_fin: "2026-07-20" })).toMatchObject({
      dernier_conge_debut: "2026-07-01",
      dernier_conge_fin: "2026-07-20",
    });
    expect(schemaSoldeInitial.safeParse({ date_reference: "2026-10-01", jours: "10", dernier_conge_debut: "2026-07-20", dernier_conge_fin: "2026-07-01" }).success).toBe(false);
    expect(schemaSoldeInitial.safeParse({ date_reference: "2026-10-01", jours: "10", dernier_conge_fin: "2026-07-01" }).success).toBe(false);
  });
});

