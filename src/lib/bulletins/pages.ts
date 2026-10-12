import "server-only";
import { PDFDocument } from "@cantoo/pdf-lib";

// Nombre de pages d'un PDF (null s'il est illisible). Les PDF protégés par le logiciel
// de paie sont lus sans mot de passe : seule la structure des pages est consultée.
export async function compterPages(contenu: Uint8Array): Promise<number | null> {
  try {
    const document = await PDFDocument.load(contenu, { ignoreEncryption: true, updateMetadata: false });
    return document.getPageCount();
  } catch {
    return null;
  }
}
