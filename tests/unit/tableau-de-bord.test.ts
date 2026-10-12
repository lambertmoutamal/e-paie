import { describe, expect, test } from "vitest";
import { absencesDuMois, compter, evolutionEffectif, joursOuvrables, repartitionSexe, type SalarieStat } from "@/lib/tableau-de-bord/calculs";

const auj = new Date("2026-10-13T10:00:00Z");
const s = (date_embauche: string, date_sortie: string | null = null, sexe: string | null = "F"): SalarieStat => ({
  sexe,
  date_embauche,
  date_sortie,
  statut: date_sortie ? "sorti" : "actif",
});

describe("tableau de bord", () => {
  test("effectif, entrées et sorties sur 12 mois", () => {
    const liste = [s("2024-01-01"), s("2026-10-05"), s("2025-01-01", "2026-10-02", "M"), s("2026-03-10", "2026-06-15", "M")];
    const e = evolutionEffectif(liste, auj);
    expect(e).toHaveLength(12);
    expect(e[0].mois).toBe("nov. 25");
    expect(e.at(-1)).toMatchObject({ mois: "oct. 26", effectif: 2, entrees: 1, sorties: 1 });
    expect(e.find((m) => m.mois === "mars 26")?.entrees).toBe(1);
    expect(e.find((m) => m.mois === "juin 26")?.sorties).toBe(1);
  });

  test("absentéisme du mois, au prorata d'une absence qui déborde", () => {
    expect(joursOuvrables(2026, 9)).toBe(27); // octobre 2026 : 31 jours dont 4 dimanches
    const r = absencesDuMois(
      [
        { debut: "2026-10-05", fin: "2026-10-09", nb_jours: 5, type: "Congé payé" },
        { debut: "2026-09-28", fin: "2026-10-03", nb_jours: 6, type: "Maladie" }, // 3 jours sur 6 en octobre
      ],
      [s("2024-01-01"), s("2024-01-01")],
      auj,
    );
    expect(r.totalJours).toBe(8);
    expect(r.parType).toEqual([
      { type: "Congé payé", jours: 5 },
      { type: "Maladie", jours: 3 },
    ]);
    expect(r.tauxAbsenteisme).toBe(14.8); // 8 / (2 × 27)
  });

  test("répartitions", () => {
    expect(repartitionSexe([s("2024-01-01"), s("2024-01-01", null, "M"), s("2024-01-01", null, null)], auj)).toEqual([
      { nom: "Femmes", valeur: 1 },
      { nom: "Hommes", valeur: 1 },
      { nom: "Non renseigné", valeur: 1 },
    ]);
    expect(compter([{ t: "cdd" }, { t: "cdi" }, { t: "cdd" }], (x) => x.t, { cdd: "CDD", cdi: "CDI" })).toEqual([
      { nom: "CDD", valeur: 2 },
      { nom: "CDI", valeur: 1 },
    ]);
  });
});
