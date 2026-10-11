import { describe, expect, test } from "vitest";
import { associerFichiers, bornesMois, estPdf, libellePeriode, lireNomFichier, salariesAttendus } from "@/lib/bulletins/regles";

describe("périodes", () => {
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
