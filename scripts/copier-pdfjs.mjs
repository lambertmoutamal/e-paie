// Copie dans public/pdfjs les fichiers dont le lecteur PDF a besoin dans le navigateur
// (polices standard, tables de caractères, modules de décodage d'images).
// Lancé automatiquement avant « npm run dev » et « npm run build ».
import { cpSync, mkdirSync } from "node:fs";

const source = "node_modules/pdfjs-dist";
const cible = "public/pdfjs";
mkdirSync(cible, { recursive: true });
for (const dossier of ["cmaps", "standard_fonts", "wasm"]) {
  cpSync(`${source}/${dossier}`, `${cible}/${dossier}`, { recursive: true });
}
console.log("✓ Fichiers du lecteur PDF copiés dans public/pdfjs");
