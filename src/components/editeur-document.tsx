"use client";

import dynamic from "next/dynamic";
import type { Proprietes } from "./editeur-document-navigateur";

// L'éditeur ne fonctionne que dans le navigateur : il n'est jamais construit par le serveur.
const Editeur = dynamic(() => import("./editeur-document-navigateur"), {
  ssr: false,
  loading: () => <div className="h-[32rem] animate-pulse rounded-xl border border-bordure bg-black/[.03]" aria-label="Chargement de l'éditeur" />,
});

export function EditeurDocument(props: Proprietes) {
  return <Editeur {...props} />;
}
