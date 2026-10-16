import { describe, expect, test } from "vitest";
import { schemaCreationEntreprise } from "@/lib/validation/schemas";

const BASE = {
  raison_sociale: "SOGEA Gabon",
  nif: "",
  rccm: "",
  numero_cnss: "123",
  numero_cnamgs: "CN-456",
  adresse: "",
  telephone: "",
  email: "",
  contact_nom: "Awa NDONG",
  contact_email: "awa@sogea.ga",
  contact_telephone: "",
  conditions: "on",
};
const CABINET = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("Créer une nouvelle entreprise", () => {
  test("paie autonome : ni cabinet ni nombre de salariés", () => {
    const r = schemaCreationEntreprise.safeParse({ ...BASE, gestion: "autonome", cabinet_id: CABINET, nb_salaries: "12" });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ gestion: "autonome", cabinet_id: null, nb_salaries: null, numero_cnamgs: "CN-456" });
  });

  test("paie gérée par un cabinet : cabinet et nombre de salariés obligatoires", () => {
    const vide = schemaCreationEntreprise.safeParse({ ...BASE, gestion: "cabinet", cabinet_id: "", nb_salaries: "" });
    expect(vide.success).toBe(false);
    expect(vide.error?.issues.map((i) => i.path[0]).sort()).toEqual(["cabinet_id", "nb_salaries"]);
    expect(schemaCreationEntreprise.safeParse({ ...BASE, gestion: "cabinet", cabinet_id: CABINET, nb_salaries: "2,5" }).success).toBe(false);

    const ok = schemaCreationEntreprise.safeParse({ ...BASE, gestion: "cabinet", cabinet_id: CABINET, nb_salaries: "25" });
    expect(ok.data).toMatchObject({ cabinet_id: CABINET, nb_salaries: 25 });
  });

  test("le choix de la gestion et les conditions sont obligatoires", () => {
    expect(schemaCreationEntreprise.safeParse({ ...BASE }).success).toBe(false);
    expect(schemaCreationEntreprise.safeParse({ ...BASE, gestion: "autonome", conditions: "" }).success).toBe(false);
  });
});
