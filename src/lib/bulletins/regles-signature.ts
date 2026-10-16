// Emplacement de la signature et du cachet sur un bulletin (fonctions pures, testées).

import { z } from "zod";

// Case « Émargement employeur » en fractions de la page, depuis le coin haut gauche
// (indépendant de la taille du PDF : A4, Letter…).
export type ZoneEmargement = { x: number; y: number; largeur: number; hauteur: number };

export const schemaZone = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    largeur: z.number().min(0.02).max(1),
    hauteur: z.number().min(0.01).max(1),
  })
  .refine((z) => z.x + z.largeur <= 1.0001 && z.y + z.hauteur <= 1.0001, { error: "La case doit rester dans la page." });

export type Cadre = { x: number; y: number; largeur: number; hauteur: number };

// Fractions → points PDF. Le PDF compte la hauteur depuis le BAS de la page.
export function zoneEnPoints(zone: ZoneEmargement, largeurPage: number, hauteurPage: number): Cadre {
  const largeur = zone.largeur * largeurPage;
  const hauteur = zone.hauteur * hauteurPage;
  return { x: zone.x * largeurPage, y: hauteurPage - zone.y * hauteurPage - hauteur, largeur, hauteur };
}

// Image ajustée dans un cadre sans la déformer, centrée.
export function ajusterImage(cadre: Cadre, largeurImage: number, hauteurImage: number): Cadre {
  const echelle = Math.min(cadre.largeur / largeurImage, cadre.hauteur / hauteurImage);
  const largeur = largeurImage * echelle;
  const hauteur = hauteurImage * echelle;
  return { x: cadre.x + (cadre.largeur - largeur) / 2, y: cadre.y + (cadre.hauteur - hauteur) / 2, largeur, hauteur };
}

// Dans la case : le cachet à gauche, la signature à droite (chacun sur la moitié),
// avec une petite marge. S'il n'y a qu'une image, elle occupe toute la case.
export function disposition(cadre: Cadre, avecCachet: boolean, avecSignature: boolean): { cachet?: Cadre; signature?: Cadre } {
  const marge = Math.min(cadre.largeur, cadre.hauteur) * 0.06;
  const interieur = { x: cadre.x + marge, y: cadre.y + marge, largeur: cadre.largeur - 2 * marge, hauteur: cadre.hauteur - 2 * marge };
  if (avecCachet && avecSignature) {
    const moitie = interieur.largeur / 2;
    return {
      cachet: { ...interieur, largeur: moitie },
      signature: { ...interieur, x: interieur.x + moitie, largeur: moitie },
    };
  }
  return avecCachet ? { cachet: interieur } : avecSignature ? { signature: interieur } : {};
}

// Vrai PNG ou JPEG (on vérifie le contenu, pas seulement le nom du fichier)
export function typeImage(octets: Uint8Array): "png" | "jpg" | null {
  if (octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) return "png";
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return "jpg";
  return null;
}
