import "server-only";
import path from "node:path";
import { createRequire } from "node:module";
import { htmlVersPdf } from "./document";

// Génération du PDF d'un contrat rédigé dans DématPaie (pdfmake, police Roboto incluse).
// Par sécurité, aucun accès à Internet et seulement les fichiers de police de pdfmake.
const require = createRequire(import.meta.url);

type Pdfmake = {
  setFonts(polices: unknown): void;
  setUrlAccessPolicy(regle: (url: string) => boolean): void;
  setLocalAccessPolicy(regle: (chemin: string) => boolean): void;
  createPdf(document: unknown): { getBuffer(): Promise<Buffer> };
};

let moteur: Pdfmake | null = null;

function pdfmake(): Pdfmake {
  if (moteur) return moteur;
  const pm = require("pdfmake") as Pdfmake;
  // Polices Roboto livrées avec pdfmake (incluses à la mise en ligne : voir next.config.ts)
  const dossierPolices = path.join(process.cwd(), "node_modules", "pdfmake", "fonts", "Roboto");
  pm.setFonts({
    Roboto: {
      normal: path.join(dossierPolices, "Roboto-Regular.ttf"),
      bold: path.join(dossierPolices, "Roboto-Medium.ttf"),
      italics: path.join(dossierPolices, "Roboto-Italic.ttf"),
      bolditalics: path.join(dossierPolices, "Roboto-MediumItalic.ttf"),
    },
  });
  pm.setUrlAccessPolicy(() => false);
  pm.setLocalAccessPolicy((chemin) => path.resolve(chemin).startsWith(dossierPolices));
  moteur = pm;
  return pm;
}

export async function genererPdf(html: string, titre: string): Promise<Buffer> {
  return pdfmake().createPdf(htmlVersPdf(html, titre)).getBuffer();
}
