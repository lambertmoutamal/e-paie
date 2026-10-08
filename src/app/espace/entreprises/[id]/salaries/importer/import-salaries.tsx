"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { readSheet } from "read-excel-file/browser";
import writeExcelFile from "write-excel-file/browser";
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { analyserFeuille, COLONNES_IMPORT, MAX_LIGNES_IMPORT, type AnalyseImport } from "@/lib/salaries/regles";
import { classesBouton } from "@/components/ui";
import { importerSalaries, type ResultatImport } from "../actions";

const INDICATIFS = [
  ["+241", "Gabon (+241)"],
  ["+237", "Cameroun (+237)"],
  ["+242", "Congo (+242)"],
  ["+235", "Tchad (+235)"],
  ["+236", "Centrafrique (+236)"],
  ["+240", "Guinée équatoriale (+240)"],
  ["+225", "Côte d'Ivoire (+225)"],
  ["+221", "Sénégal (+221)"],
  ["+229", "Bénin (+229)"],
  ["+228", "Togo (+228)"],
  ["+226", "Burkina Faso (+226)"],
  ["+223", "Mali (+223)"],
  ["+33", "France (+33)"],
] as const;

async function telechargerModele() {
  const entetes = COLONNES_IMPORT.map((c) => ({ value: c.libelle + (c.obligatoire ? " *" : ""), fontWeight: "bold" as const }));
  const exemple = COLONNES_IMPORT.map((c) => ({ value: c.exemple }));
  await writeExcelFile([entetes, exemple], {
    columns: COLONNES_IMPORT.map((c) => ({ width: Math.max(14, c.libelle.length + 4) })),
  }).toFile("modele-import-salaries.xlsx");
}

export function ImportSalaries({ entrepriseId }: { entrepriseId: string }) {
  const [indicatif, setIndicatif] = useState("+241");
  const [nomFichier, setNomFichier] = useState("");
  const [analyse, setAnalyse] = useState<AnalyseImport | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [enCours, demarrer] = useTransition();

  async function lireFichier(fichier: File | undefined) {
    setAnalyse(null);
    setResultat(null);
    setErreurLecture(null);
    if (!fichier) return;
    if (!fichier.name.toLowerCase().endsWith(".xlsx")) {
      setErreurLecture("Choisissez un fichier Excel au format .xlsx (dans Excel : Fichier → Enregistrer sous → Classeur Excel).");
      return;
    }
    setNomFichier(fichier.name);
    try {
      const feuille = await readSheet(fichier);
      const resultatAnalyse = analyserFeuille(feuille as unknown[][], indicatif);
      if (resultatAnalyse.lignes.length > MAX_LIGNES_IMPORT) {
        setErreurLecture(`Le fichier contient plus de ${MAX_LIGNES_IMPORT} salariés : découpez-le en plusieurs fichiers.`);
        return;
      }
      setAnalyse(resultatAnalyse);
    } catch {
      setErreurLecture("Ce fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier Excel (.xlsx) non protégé.");
    }
  }

  const valides = analyse?.lignes.filter((l) => l.donnees) ?? [];
  const enErreur = analyse?.lignes.filter((l) => !l.donnees) ?? [];

  function importer() {
    demarrer(async () => {
      const r = await importerSalaries(
        entrepriseId,
        nomFichier,
        valides.map((l) => ({ numero: l.numero, donnees: l.donnees })),
        indicatif,
      );
      setResultat(r);
    });
  }

  if (resultat && "crees" in resultat) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-marque/20 bg-marque-claire p-5">
        <p className="flex items-center gap-2 text-lg font-semibold text-marque-fonce">
          <CircleCheck aria-hidden /> Import terminé
        </p>
        <p>
          <strong>{resultat.crees}</strong> salarié(s) créé(s), <strong>{resultat.misAJour}</strong> mis à jour.
        </p>
        <Link href={`/espace/entreprises/${entrepriseId}/salaries`} className={classesBouton("principal")}>
          Voir la liste des salariés
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-bordure bg-surface p-5">
        <h2 className="font-semibold">1. Préparez votre fichier</h2>
        <p className="mt-1 text-sm text-doux">
          Téléchargez le modèle, remplissez une ligne par salarié, puis enregistrez-le. Colonnes obligatoires : matricule, nom,
          prénoms, date d&apos;embauche. Un matricule déjà connu met à jour le salarié existant.
        </p>
        <p className="mt-2 text-sm text-doux">
          Astuce : si vos matricules commencent par 0 (ex. 0123), sélectionnez la colonne Matricule dans Excel, puis clic droit →
          Format de cellule → Texte, sinon Excel supprime le 0.
        </p>
        <button type="button" onClick={telechargerModele} className={`${classesBouton("secondaire")} mt-4`}>
          <Download size={16} aria-hidden /> Télécharger le modèle Excel
        </button>
      </section>

      <section className="rounded-xl border border-bordure bg-surface p-5">
        <h2 className="font-semibold">2. Chargez le fichier rempli</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Indicatif des numéros sans « + »
            <select
              value={indicatif}
              onChange={(e) => setIndicatif(e.target.value)}
              className="h-11 rounded-lg border border-bordure bg-surface px-3 font-normal"
            >
              {INDICATIFS.map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>
                  {libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Fichier Excel (.xlsx)
            <span className={`${classesBouton("secondaire")} cursor-pointer`}>
              <Upload size={16} aria-hidden /> {nomFichier || "Choisir le fichier"}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => lireFichier(e.target.files?.[0])}
              />
            </span>
          </label>
        </div>
        {erreurLecture && (
          <p role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {erreurLecture}
          </p>
        )}
      </section>

      {analyse && (
        <section className="rounded-xl border border-bordure bg-surface p-5">
          <h2 className="font-semibold">3. Vérifiez puis importez</h2>

          {analyse.colonnesManquantes.length > 0 ? (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Colonnes obligatoires introuvables : <strong>{analyse.colonnesManquantes.join(", ")}</strong>. Utilisez le modèle
              Excel ou renommez vos en-têtes.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-marque-claire px-3 py-1 font-medium text-marque">{valides.length} ligne(s) correcte(s)</span>
                {enErreur.length > 0 && (
                  <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">{enErreur.length} ligne(s) en erreur</span>
                )}
                {analyse.colonnesIgnorees.length > 0 && (
                  <span className="rounded-full bg-black/[.05] px-3 py-1 text-doux">
                    Colonnes ignorées : {analyse.colonnesIgnorees.join(", ")}
                  </span>
                )}
              </div>

              {enErreur.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200">
                  <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                    Lignes à corriger dans votre fichier
                  </p>
                  <ul className="max-h-64 divide-y divide-red-100 overflow-y-auto text-sm">
                    {enErreur.map((l) => (
                      <li key={l.numero} className="px-3 py-2">
                        <strong>Ligne {l.numero}</strong> : {l.erreurs.join(" ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {valides.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-bordure">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="bg-black/[.03] text-doux">
                      <tr>
                        <th className="px-3 py-2 font-medium">Ligne</th>
                        <th className="px-3 py-2 font-medium">Matricule</th>
                        <th className="px-3 py-2 font-medium">Nom et prénoms</th>
                        <th className="px-3 py-2 font-medium">Embauche</th>
                        <th className="px-3 py-2 font-medium">Téléphone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordure">
                      {valides.slice(0, 100).map((l) => (
                        <tr key={l.numero}>
                          <td className="px-3 py-2 text-doux">{l.numero}</td>
                          <td className="px-3 py-2">{l.donnees!.matricule}</td>
                          <td className="px-3 py-2">{l.donnees!.nom} {l.donnees!.prenoms}</td>
                          <td className="px-3 py-2">{l.donnees!.date_embauche.split("-").reverse().join("/")}</td>
                          <td className="px-3 py-2">{l.donnees!.telephone ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {valides.length > 100 && <p className="px-3 py-2 text-xs text-doux">… et {valides.length - 100} autre(s).</p>}
                </div>
              )}

              {resultat && "erreur" in resultat && (
                <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <p className="font-semibold">{resultat.erreur}</p>
                  {resultat.lignesEnErreur?.map((l) => (
                    <p key={l.numero}>
                      {l.numero ? `Ligne ${l.numero} : ` : ""}
                      {l.erreurs.join(" ")}
                    </p>
                  ))}
                </div>
              )}

              {valides.length > 0 && (
                <div className="mt-5 flex flex-col items-start gap-2">
                  <button type="button" onClick={importer} disabled={enCours} className={classesBouton("principal")}>
                    {enCours ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <FileSpreadsheet size={16} aria-hidden />}
                    {enCours ? "Import en cours…" : `Importer ${valides.length} salarié(s)`}
                  </button>
                  {enErreur.length > 0 && (
                    <p className="text-xs text-doux">Les {enErreur.length} ligne(s) en erreur ne seront pas importées.</p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
