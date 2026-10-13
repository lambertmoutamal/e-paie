"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readSheet } from "read-excel-file/browser";
import { CircleAlert, CircleCheck, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { analyserResultats, CHAMPS_RESULTAT, deviner, trouverEntetes, type Cible } from "@/lib/paie/import-resultats";
import { classesBouton } from "@/components/ui";
import { importerResultats } from "./actions";

const OPTIONS: { valeur: Cible; libelle: string }[] = [
  { valeur: "matricule", libelle: "Matricule (obligatoire)" },
  ...CHAMPS_RESULTAT.map((c) => ({ valeur: c.cle as Cible, libelle: c.libelle })),
  { valeur: "rubrique", libelle: "Autre rubrique (conservée telle quelle)" },
  { valeur: "ignorer", libelle: "Ne pas importer" },
];

// Import de l'Excel des résultats de paie : lecture sur l'ordinateur, correspondance des
// colonnes (devinée puis modifiable), contrôle ligne par ligne, puis envoi.
export function ImportResultats({ entrepriseId, periodeId, salaries }: { entrepriseId: string; periodeId: string; salaries: { id: string; matricule: string }[] }) {
  const router = useRouter();
  const [feuille, setFeuille] = useState<unknown[][] | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [ligneEntetes, setLigneEntetes] = useState(-1);
  const [correspondance, setCorrespondance] = useState<Cible[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function lire(fichier: File | undefined) {
    setErreur(null);
    setMessage(null);
    setFeuille(null);
    if (!fichier) return;
    if (!fichier.name.toLowerCase().endsWith(".xlsx")) return setErreur("Choisissez un fichier Excel au format .xlsx (Fichier → Enregistrer sous → Classeur Excel).");
    try {
      const donnees = (await readSheet(fichier)) as unknown[][];
      const i = trouverEntetes(donnees);
      if (i < 0) return setErreur("Colonne « Matricule » introuvable dans les 10 premières lignes du fichier.");
      setNomFichier(fichier.name);
      setFeuille(donnees);
      setLigneEntetes(i);
      setCorrespondance((donnees[i] ?? []).map(deviner));
    } catch {
      setErreur("Le fichier Excel n'a pas pu être lu.");
    }
  }

  const lignes = useMemo(() => (feuille ? analyserResultats(feuille, ligneEntetes, correspondance, salaries) : []), [feuille, ligneEntetes, correspondance, salaries]);
  const valides = lignes.filter((l) => l.salarieId && !l.erreurs.length);
  const enErreur = lignes.filter((l) => !l.salarieId || l.erreurs.length);
  const sansMatricule = feuille && !correspondance.includes("matricule");

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    const r = await importerResultats(
      entrepriseId,
      periodeId,
      valides.map((l) => ({ salarie_id: l.salarieId, champs: l.champs, rubriques: l.rubriques })),
    );
    setEnCours(false);
    if (!r.ok) return setErreur(r.erreur);
    setMessage(`${r.nombre} résultat(s) de paie importé(s).`);
    setFeuille(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-bordure px-4 py-7 text-center hover:border-marque/50 hover:bg-marque-claire/40">
        <FileSpreadsheet size={28} className="text-emerald-600" aria-hidden />
        <span className="font-semibold">{nomFichier && feuille ? `Fichier : ${nomFichier} — cliquez pour en choisir un autre` : "Choisissez l'Excel des résultats de paie du mois"}</span>
        <span className="text-sm text-doux">Une ligne par salarié, avec une colonne « Matricule ». Format .xlsx.</span>
        <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => lire(e.target.files?.[0])} />
      </label>

      {erreur && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {erreur}
        </p>
      )}
      {message && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CircleCheck size={16} aria-hidden />
          {message}
        </p>
      )}

      {feuille && (
        <>
          <details open className="rounded-xl border border-bordure">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Correspondance des colonnes (vérifiez, modifiez si besoin)</summary>
            <div className="grid gap-2 border-t border-bordure p-4 sm:grid-cols-2">
              {(feuille[ligneEntetes] ?? []).map((entete, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 truncate font-medium" title={String(entete ?? "")}>
                    {String(entete ?? `Colonne ${i + 1}`)}
                  </span>
                  <select
                    value={correspondance[i] ?? "ignorer"}
                    onChange={(e) => setCorrespondance((c) => c.map((x, j) => (j === i ? (e.target.value as Cible) : x)))}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-bordure bg-surface px-2"
                  >
                    {OPTIONS.map((o) => (
                      <option key={o.valeur} value={o.valeur}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm">
            <span>
              <strong className="text-emerald-700">{valides.length}</strong> ligne(s) prête(s)
              {enErreur.length > 0 && (
                <>
                  , <strong className="text-red-700">{enErreur.length}</strong> à corriger (non importée{enErreur.length > 1 ? "s" : ""})
                </>
              )}
            </span>
            <button type="button" onClick={envoyer} disabled={enCours || !valides.length || Boolean(sansMatricule)} className={classesBouton("principal", "petit")}>
              {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
              Importer {valides.length} ligne(s)
            </button>
          </div>
          {sansMatricule && <p className="text-sm text-red-700">Indiquez quelle colonne contient le matricule.</p>}

          {enErreur.length > 0 && (
            <ul className="divide-y divide-bordure rounded-lg border border-red-200 text-sm">
              {enErreur.slice(0, 50).map((l) => (
                <li key={l.numero} className="flex gap-3 px-3 py-2">
                  <span className="w-20 shrink-0 font-medium">Ligne {l.numero}</span>
                  <span className="text-red-700">{l.erreurs.join(" ")}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
