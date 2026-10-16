import { describe, expect, test } from "vitest";
import { associerFichiers, bornesMois, estPdf, libellePeriode, lireCircuit, lireNomFichier, moisProposes, salariesAttendus } from "@/lib/bulletins/regles";

describe("périodes", () => {
  test("mois proposés dans l'ordre du calendrier, de janvier à décembre", () => {
    const liste = moisProposes(new Date(Date.UTC(2026, 9, 16))).map((m) => m.libelle);
    expect(liste).toHaveLength(15);
    expect(liste.slice(0, 4)).toEqual(["Octobre 2025", "Novembre 2025", "Décembre 2025", "Janvier 2026"]);
    expect(liste.slice(-3)).toEqual(["Octobre 2026", "Novembre 2026", "Décembre 2026"]);
  });

  test("libellé et bornes du mois (années bissextiles comprises)", () => {
    expect(libellePeriode(2026, 10)).toBe("Octobre 2026");
    expect(bornesMois(2028, 2)).toEqual({ debut: "2028-02-01", fin: "2028-02-29" });
  });

  test("salariés attendus : embauchés avant la fin du mois, pas sortis avant son début", () => {
    const s = (id: string, date_embauche: string, statut = "actif", date_sortie: string | null = null) => ({ id, matricule: id, statut, date_embauche, date_sortie });
    const liste = [
      s("present", "2024-01-01"),
      s("arrive_en_cours_de_mois", "2026-10-15"),
      s("arrive_le_mois_suivant", "2026-11-01"),
      s("sorti_en_cours_de_mois", "2024-01-01", "sorti", "2026-10-10"),
      s("sorti_avant", "2024-01-01", "sorti", "2026-09-30"),
    ];
    expect(salariesAttendus(liste, 2026, 10).map((x) => x.id)).toEqual(["present", "arrive_en_cours_de_mois", "sorti_en_cours_de_mois"]);
  });
});

describe("noms de fichiers", () => {
  test("lit le matricule et la période", () => {
    expect(lireNomFichier("0123_2026-10.pdf")).toEqual({ matricule: "0123", annee: 2026, mois: 10 });
    expect(lireNomFichier("0123_10-2026.PDF")).toEqual({ matricule: "0123", annee: 2026, mois: 10 });
    expect(lireNomFichier("A-45.pdf")).toEqual({ matricule: "A-45", annee: null, mois: null });
    expect(lireNomFichier("bulletin.docx")).toBeNull();
  });

  test("associe les fichiers aux salariés et signale les problèmes", () => {
    const salaries = [
      { id: "s1", matricule: "0123", nom: "NDONG", prenoms: "Awa" },
      { id: "s2", matricule: "0456", nom: "MBA", prenoms: "Paul" },
    ];
    const r = associerFichiers(
      [
        { nom: "0123_2026-10.pdf", taille: 1000 },
        { nom: "0456.pdf", taille: 1000 },
        { nom: "0999_2026-10.pdf", taille: 1000 },
        { nom: "0123_2026-09.pdf", taille: 1000 },
        { nom: "0123.pdf", taille: 1000 },
        { nom: "photo.jpg", taille: 1000 },
        { nom: "0456_2026-10.pdf", taille: 3 * 1024 * 1024 },
      ],
      salaries,
      2026,
      10,
    );
    expect(r.map((x) => x.etat)).toEqual(["ok", "ok", "inconnu", "mauvaise_periode", "doublon", "pas_pdf", "trop_lourd"]);
    expect(r[0]).toMatchObject({ salarieId: "s1", message: "NDONG Awa" });
    expect(r[3].message).toBe("Le nom indique Septembre 2026, pas Octobre 2026.");
  });
});

describe("contrôle du contenu", () => {
  test("reconnaît un vrai PDF, refuse un fichier renommé", () => {
    expect(estPdf(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
    expect(estPdf(new TextEncoder().encode("MZ\x90\x00 programme"))).toBe(false);
    expect(estPdf(new Uint8Array())).toBe(false);
  });
});

describe("circuit de validation", () => {
  const formulaire = (champs: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(champs)) f.set(k, v);
    return f;
  };

  test("lit un circuit valide de plusieurs étapes", () => {
    const r = lireCircuit(formulaire({ nombre: "2", libelle_1: " Contrôle ", role_1: "controleur", libelle_2: "Visa DG", role_2: "signataire" }));
    expect(r).toEqual({ ok: true, etapes: [{ libelle: "Contrôle", role: "controleur" }, { libelle: "Visa DG", role: "signataire" }] });
  });

  test("refuse un circuit vide, trop long ou mal rempli", () => {
    expect(lireCircuit(formulaire({ nombre: "0" })).ok).toBe(false);
    expect(lireCircuit(formulaire({ nombre: "6" })).ok).toBe(false);
    const r = lireCircuit(formulaire({ nombre: "1", libelle_1: "X", role_1: "gestionnaire_paie" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erreurs).sort()).toEqual(["libelle_1", "role_1"]);
  });
});
