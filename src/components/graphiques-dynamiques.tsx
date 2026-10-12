"use client";

import dynamic from "next/dynamic";

// Les graphiques se dessinent dans le navigateur uniquement (mesure de la largeur disponible).
const attente = () => <div className="h-[220px] animate-pulse rounded-xl bg-black/[.03]" aria-label="Chargement du graphique" />;

export const GraphiqueEffectif = dynamic(() => import("./graphiques").then((m) => m.GraphiqueEffectif), { ssr: false, loading: attente });
export const GraphiqueMouvements = dynamic(() => import("./graphiques").then((m) => m.GraphiqueMouvements), { ssr: false, loading: attente });
export const GraphiqueAnneau = dynamic(() => import("./graphiques").then((m) => m.GraphiqueAnneau), { ssr: false, loading: attente });
export const GraphiqueBarresHorizontales = dynamic(() => import("./graphiques").then((m) => m.GraphiqueBarresHorizontales), { ssr: false, loading: attente });
