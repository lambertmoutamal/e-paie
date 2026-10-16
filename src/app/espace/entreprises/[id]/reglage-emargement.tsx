"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, FileText, LoaderCircle, Stamp, Trash2, Upload } from "lucide-react";
import type { ZoneEmargement } from "@/lib/bulletins/regles-signature";
import type { EtatFormulaire } from "@/lib/validation/formulaire";
import { classesBouton } from "@/components/ui";
import { deposerImageSignature, enregistrerZoneEmargement, retirerImageSignature } from "../actions";

function Message({ etat }: { etat: EtatFormulaire }) {
  if (!etat?.erreur && !etat?.succes) return null;
  return (
    <p className={`flex items-start gap-1.5 text-xs ${etat.erreur ? "text-red-700" : "text-marque"}`}>
      {etat.erreur ? <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> : <CircleCheck size={13} className="mt-0.5 shrink-0" aria-hidden />}
      {etat.erreur ?? etat.succes}
    </p>
  );
}

// Dépôt (ou remplacement) de l'image de signature ou du cachet
function DepotImage({ entrepriseId, type, apercu }: { entrepriseId: string; type: "signature" | "cachet"; apercu: string | null }) {
  const [etat, envoyer, enCours] = useActionState(deposerImageSignature.bind(null, entrepriseId, type), undefined);
  const [etatRetrait, retirer, retraitEnCours] = useActionState(retirerImageSignature.bind(null, entrepriseId, type), undefined);
  const libelle = type === "signature" ? "Signature" : "Cachet de l'entreprise";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-bordure p-3">
      <p className="text-sm font-semibold">{libelle}</p>
      <div className="grid h-28 place-items-center rounded-lg border border-dashed border-bordure bg-[repeating-conic-gradient(#f3f4f8_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element -- image privée servie par un lien temporaire
          <img src={apercu} alt={libelle} className="max-h-24 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-doux">Aucune image</span>
        )}
      </div>
      <form action={envoyer} className="flex flex-wrap items-center gap-2">
        <input type="file" name="fichier" accept="image/png,image/jpeg" required className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-marque-claire file:px-2 file:py-1 file:text-marque" />
        <button type="submit" disabled={enCours} className={classesBouton("secondaire", "petit")}>
          {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
          {apercu ? "Remplacer" : "Déposer"}
        </button>
      </form>
      {apercu && (
        <form action={retirer}>
          <button type="submit" disabled={retraitEnCours} className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline">
            <Trash2 size={12} aria-hidden />
            Retirer
          </button>
        </form>
      )}
      <Message etat={etat ?? etatRetrait} />
      <p className="text-xs text-doux">PNG à fond transparent de préférence (scan découpé), 1 Mo maximum.</p>
    </div>
  );
}

// Rendu de la 1re page d'un PDF (lu sur l'ordinateur, jamais envoyé) dans un canevas
async function dessinerPremierePage(fichier: File, canevas: HTMLCanvasElement, largeurMax: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const chargement = pdfjs.getDocument({
    data: new Uint8Array(await fichier.arrayBuffer()),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  const document = await chargement.promise;
  const page = await document.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const vue = page.getViewport({ scale: largeurMax / base.width });
  canevas.width = vue.width;
  canevas.height = vue.height;
  await page.render({ canvas: canevas, canvasContext: canevas.getContext("2d")!, viewport: vue }).promise;
  await chargement.destroy();
}

const pourcent = (v: number) => `${Math.round(v * 1000) / 10} %`;

// Tracé de la case « Émargement employeur » sur un bulletin modèle
function TraceZone({ entrepriseId, zoneInitiale, apercuSignature, apercuCachet }: { entrepriseId: string; zoneInitiale: ZoneEmargement | null; apercuSignature: string | null; apercuCachet: string | null }) {
  const canevas = useRef<HTMLCanvasElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const [modele, setModele] = useState<string | null>(null);
  const [erreurModele, setErreurModele] = useState<string | null>(null);
  const [zone, setZone] = useState<ZoneEmargement | null>(zoneInitiale);
  const [depart, setDepart] = useState<{ x: number; y: number } | null>(null);
  const [etat, setEtat] = useState<EtatFormulaire>(undefined);
  const [enCours, demarrer] = useTransition();

  async function choisirModele(fichier: File | undefined) {
    setErreurModele(null);
    if (!fichier || !canevas.current) return;
    try {
      await dessinerPremierePage(fichier, canevas.current, Math.min(620, cadre.current?.clientWidth ?? 620));
      setModele(fichier.name);
    } catch {
      setErreurModele("Ce PDF n'a pas pu être lu. Choisissez un bulletin exporté par votre logiciel de paie.");
    }
  }

  // Position du pointeur en fractions de la page
  const position = (e: React.PointerEvent) => {
    const r = canevas.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const pendantTrace = (e: React.PointerEvent) => {
    if (!depart) return;
    const p = position(e);
    setZone({ x: Math.min(depart.x, p.x), y: Math.min(depart.y, p.y), largeur: Math.abs(p.x - depart.x), hauteur: Math.abs(p.y - depart.y) });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-bordure p-3">
      <p className="text-sm font-semibold">Emplacement de la case « Émargement employeur »</p>
      <p className="text-xs text-doux">
        Choisissez un bulletin modèle de cette entreprise (PDF, lu sur votre ordinateur), puis tracez la case à la souris : cliquez à un coin et faites glisser jusqu&apos;au
        coin opposé. Le cachet est placé dans la moitié gauche, la signature dans la moitié droite.
      </p>
      <label className={`${classesBouton("secondaire", "petit")} w-fit cursor-pointer`}>
        <FileText size={14} aria-hidden />
        {modele ? `Modèle : ${modele} — en choisir un autre` : "Choisir un bulletin modèle (PDF)"}
        <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => choisirModele(e.target.files?.[0])} />
      </label>
      {erreurModele && <p className="text-xs text-red-700">{erreurModele}</p>}

      <div ref={cadre} className="w-full">
        <div className={`relative inline-block touch-none select-none ${modele ? "cursor-crosshair border border-bordure shadow-sm" : "hidden"}`}>
          <canvas
            ref={canevas}
            className="block max-w-full"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDepart(position(e));
              setEtat(undefined);
            }}
            onPointerMove={pendantTrace}
            onPointerUp={() => setDepart(null)}
          />
          {zone && (
            <div
              className="pointer-events-none absolute flex border-2 border-accent bg-accent/10"
              style={{ left: pourcent(zone.x), top: pourcent(zone.y), width: pourcent(zone.largeur), height: pourcent(zone.hauteur) }}
            >
              {/* Aperçu de ce qui sera apposé */}
              <div className="grid flex-1 place-items-center p-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {apercuCachet ? <img src={apercuCachet} alt="" className="max-h-full max-w-full object-contain opacity-90" /> : <Stamp size={14} className="text-accent" />}
              </div>
              <div className="grid flex-1 place-items-center p-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {apercuSignature && <img src={apercuSignature} alt="" className="max-h-full max-w-full object-contain opacity-90" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {zone && !modele && (
        <p className="text-xs text-doux">
          Case enregistrée : à {pourcent(zone.x)} du bord gauche et {pourcent(zone.y)} du haut de la page ({pourcent(zone.largeur)} × {pourcent(zone.hauteur)}). Choisissez un
          bulletin modèle pour la voir ou la modifier.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!zone || !modele || enCours || zone.largeur < 0.02 || zone.hauteur < 0.01}
          className={classesBouton("principal", "petit")}
          onClick={() => demarrer(async () => setEtat(await enregistrerZoneEmargement(entrepriseId, zone)))}
        >
          {enCours && <LoaderCircle size={14} className="animate-spin" aria-hidden />}
          Enregistrer l&apos;emplacement
        </button>
        <Message etat={etat} />
      </div>
    </div>
  );
}

export function ReglageEmargement(p: { entrepriseId: string; zone: ZoneEmargement | null; apercuSignature: string | null; apercuCachet: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DepotImage entrepriseId={p.entrepriseId} type="cachet" apercu={p.apercuCachet} />
        <DepotImage entrepriseId={p.entrepriseId} type="signature" apercu={p.apercuSignature} />
      </div>
      <TraceZone entrepriseId={p.entrepriseId} zoneInitiale={p.zone} apercuSignature={p.apercuSignature} apercuCachet={p.apercuCachet} />
    </div>
  );
}
