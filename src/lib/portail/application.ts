// Application installable de l'espace salarié (« DématPaie Salarié ») : réglages communs
// au manifeste, aux icônes et aux métadonnées. Fonctions pures (testées).

export const COULEUR_MARQUE = "#4f46e5";
export const TAILLES_ICONE = [180, 192, 512] as const;
export type VarianteIcone = "standard" | "masquable";

// Manifeste : l'application s'ouvre en plein écran sur l'espace salarié et ne couvre QUE ses
// pages (l'espace employeur reste un site classique).
export function manifesteSalarie() {
  return {
    id: "/portail",
    name: "DématPaie Salarié",
    short_name: "DématPaie",
    description: "Vos bulletins de paie, sur votre téléphone. Connexion par code WhatsApp.",
    lang: "fr",
    start_url: "/portail",
    scope: "/portail",
    display: "standalone" as const,
    orientation: "portrait" as const,
    background_color: "#ffffff",
    theme_color: COULEUR_MARQUE,
    icons: [
      { src: "/icone-salarie/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-salarie/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-salarie/512?variante=masquable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

// Taille demandée dans l'adresse de l'icône : seulement les tailles prévues
export function lireTailleIcone(valeur: string): number | null {
  const n = Number(valeur);
  return (TAILLES_ICONE as readonly number[]).includes(n) ? n : null;
}

// Logo DématPaie (bulletin stylisé) en SVG, pour générer les icônes.
// Variante « masquable » : marges plus larges (Android découpe l'icône en cercle ou en goutte).
export function logoSvg(variante: VarianteIcone): string {
  const marge = variante === "masquable" ? 7 : 0;
  const t = 32 + marge * 2;
  const coin = variante === "masquable" ? 0 : 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">
<rect width="${t}" height="${t}" rx="${coin}" fill="${COULEUR_MARQUE}"/>
<g transform="translate(${marge} ${marge})">
<path d="M10 8h9l4 4v12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill="#ffffff"/>
<path d="M12 15h8M12 18.5h8M12 22h5" stroke="${COULEUR_MARQUE}" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="23" cy="9" r="3" fill="#f2665a"/>
</g></svg>`;
}
