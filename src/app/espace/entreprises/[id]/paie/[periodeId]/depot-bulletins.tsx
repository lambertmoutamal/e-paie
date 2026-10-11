"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, FileUp, LoaderCircle, Upload } from "lucide-react";
import { associerFichiers, type FichierAssocie } from "@/lib/bulletins/regles";
import { classesBouton } from "@/components/ui";
import { deposerBulletin } from "../actions";

type SalarieAttendu = { id: string; matricule: string; nom: string; prenoms: string; aBulletin: boolean };
type Ligne = FichierAssocie & { fichier: File; resultat?: { ok: boolean; message: string } };

// Dépôt en masse : les fichiers sont reconnus par leur nom (matricule), contrôlés
// avant l'envoi, puis envoyés un par un avec suivi de la progression.
export function DepotEnMasse({
  entrepriseId,
  periodeId,
  annee,
  mois,
  salaries,
}: {
  entrepriseId: string;
  periodeId: string;
  annee: number;
  mois: number;
  salaries: SalarieAttendu[];
}) {
  const router = useRouter();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [progression, setProgression] = useState({ faits: 0, total: 0 });
  const [enCours, setEnCours] = useState(false);
  const avecBulletin = new Set(salaries.filter((s) => s.aBulletin).map((s) => s.id));

  function choisir(fichiers: FileList | null) {
    const liste = Array.from(fichiers ?? []);
    const associes = associerFichiers(liste.map((f) => ({ nom: f.name, taille: f.size })), salaries, annee, mois);
    setLignes(associes.map((a, i) => ({ ...a, fichier: liste[i] })));
  }

  const aEnvoyer = lignes.filter((l) => l.etat === "ok" && !l.resultat?.ok);
  const nbProblemes = lignes.filter((l) => l.etat !== "ok").length;

  async function envoyer() {
    setEnCours(true);
    setProgression({ faits: 0, total: aEnvoyer.length });
    for (const ligne of aEnvoyer) {
      const formulaire = new FormData();
      formulaire.set("fichier", ligne.fichier);
      let resultat: Ligne["resultat"];
      try {
        const r = await deposerBulletin(entrepriseId, periodeId, ligne.salarieId!, formulaire);
        resultat = r.ok ? { ok: true, message: r.remplace ? "Remplacé" : "Déposé" } : { ok: false, message: r.erreur };
      } catch {
        resultat = { ok: false, message: "Envoi interrompu (connexion ?). Réessayez." };
      }
      setLignes((avant) => avant.map((l) => (l === ligne ? { ...l, resultat } : l)));
      setProgression((p) => ({ ...p, faits: p.faits + 1 }));
    }
    setEnCours(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-doux">
        Nommez chaque fichier avec le <strong className="text-foreground">matricule</strong> du salarié, par exemple{" "}
        <code className="rounded bg-black/[.05] px-1">0123_{annee}-{String(mois).padStart(2, "0")}.pdf</code> ou{" "}
        <code className="rounded bg-black/[.05] px-1">0123.pdf</code>. Chaque bulletin est rattaché automatiquement au bon salarié.
      </p>

      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-bordure px-4 py-8 text-center hover:border-marque/50 hover:bg-marque-claire/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!enCours) choisir(e.dataTransfer.files);
        }}
      >
        <FileUp size={28} className="text-marque" aria-hidden />
        <span className="font-semibold">Glissez les bulletins ici ou cliquez pour les choisir</span>
        <span className="text-sm text-doux">PDF uniquement, 2 Mo maximum par fichier</span>
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="sr-only"
          disabled={enCours}
          onChange={(e) => choisir(e.target.files)}
        />
      </label>

      {lignes.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm">
            <span>
              <strong>{lignes.length}</strong> fichier(s) : <strong className="text-marque">{lignes.length - nbProblemes}</strong> reconnu(s)
              {nbProblemes > 0 && (
                <>
                  , <strong className="text-red-700">{nbProblemes}</strong> à corriger (non envoyé{nbProblemes > 1 ? "s" : ""})
                </>
              )}
            </span>
            <button type="button" className={classesBouton("principal", "petit")} disabled={enCours || aEnvoyer.length === 0} onClick={envoyer}>
              {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
              {enCours ? `Envoi ${progression.faits}/${progression.total}…` : `Déposer ${aEnvoyer.length} bulletin(s)`}
            </button>
          </div>

          {enCours && (
            <div className="h-2 overflow-hidden rounded-full bg-black/[.06]" role="progressbar" aria-valuemin={0} aria-valuemax={progression.total} aria-valuenow={progression.faits}>
              <div className="h-full bg-marque transition-all" style={{ width: `${(progression.faits / Math.max(1, progression.total)) * 100}%` }} />
            </div>
          )}

          <ul className="divide-y divide-bordure rounded-lg border border-bordure text-sm">
            {lignes.map((l, i) => {
              const reussi = l.resultat?.ok;
              const echec = l.resultat && !l.resultat.ok;
              const probleme = l.etat !== "ok";
              return (
                <li key={`${l.nom}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  {probleme || echec ? (
                    <CircleAlert size={16} className="shrink-0 text-red-600" aria-hidden />
                  ) : (
                    <CircleCheck size={16} className={`shrink-0 ${reussi ? "text-marque" : "text-doux"}`} aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{l.nom}</span>
                  <span className={`text-right ${probleme || echec ? "text-red-700" : "text-doux"}`}>
                    {l.resultat?.message ?? l.message}
                    {!probleme && !l.resultat && l.salarieId && avecBulletin.has(l.salarieId) && " · remplacera le bulletin actuel"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// Dépôt ou remplacement du bulletin d'un seul salarié (depuis le tableau).
export function DepotUnique({
  entrepriseId,
  periodeId,
  salarieId,
  libelle,
}: {
  entrepriseId: string;
  periodeId: string;
  salarieId: string;
  libelle: string;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function envoyer(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    demarrer(async () => {
      const formulaire = new FormData();
      formulaire.set("fichier", fichier);
      const r = await deposerBulletin(entrepriseId, periodeId, salarieId, formulaire);
      if (!r.ok) setErreur(r.erreur);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className={`${classesBouton("secondaire", "petit")} cursor-pointer ${enCours ? "pointer-events-none opacity-60" : ""}`}>
        {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
        {libelle}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          disabled={enCours}
          onChange={(e) => {
            envoyer(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {erreur && <p className="max-w-56 text-right text-xs text-red-700">{erreur}</p>}
    </div>
  );
}
