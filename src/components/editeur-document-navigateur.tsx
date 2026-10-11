"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Bold,
  FileUp,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  Pilcrow,
  Redo2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { CHAMPS_DOCUMENT } from "@/lib/contrats/champs";

// Éditeur de texte simple (comme un petit traitement de texte) pour les modèles et
// les contrats. Le texte est envoyé au serveur dans un champ caché, en HTML simple,
// puis nettoyé par le serveur avant d'être enregistré. Chargé dans le navigateur
// uniquement (voir editeur-document.tsx).
export type Proprietes = {
  nom?: string;
  contenuInitial: string;
  avecChamps?: boolean;
  avecImportWord?: boolean;
  lectureSeule?: boolean;
};

export default function Editeur({
  nom = "contenu",
  contenuInitial,
  avecChamps,
  avecImportWord,
  lectureSeule,
}: Proprietes) {
  const [html, setHtml] = useState(contenuInitial);
  const editeur = useEditor({
    extensions: [StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }), TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: contenuInitial,
    editable: !lectureSeule,
    immediatelyRender: false,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    editorProps: { attributes: { class: "document-contrat min-h-[28rem] px-6 py-6 outline-none sm:px-10", "aria-label": "Texte du document" } },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-bordure bg-surface">
      {editeur && !lectureSeule && <BarreOutils editeur={editeur} avecChamps={avecChamps} avecImportWord={avecImportWord} />}
      <div className="max-h-[70vh] overflow-y-auto bg-black/[.02] p-2 sm:p-6">
        <div className="mx-auto max-w-[52rem] rounded-sm bg-white shadow-sm ring-1 ring-black/5">
          <EditorContent editor={editeur} />
        </div>
      </div>
      <input type="hidden" name={nom} value={html} />
    </div>
  );
}

function BarreOutils({ editeur, avecChamps, avecImportWord }: { editeur: Editor; avecChamps?: boolean; avecImportWord?: boolean }) {
  // L'état des boutons (gras actif…) se met à jour à chaque frappe
  const etat = useEditorState({
    editor: editeur,
    selector: ({ editor: e }) => ({
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      gras: e.isActive("bold"),
      italique: e.isActive("italic"),
      souligne: e.isActive("underline"),
      puces: e.isActive("bulletList"),
      numeros: e.isActive("orderedList"),
      centre: e.isActive({ textAlign: "center" }),
      justifie: e.isActive({ textAlign: "justify" }),
      annuler: e.can().undo(),
      retablir: e.can().redo(),
    }),
  });
  const chaine = () => editeur.chain().focus();

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-bordure bg-surface px-2 py-2" role="toolbar" aria-label="Mise en forme">
      <Bouton icone={Heading1} titre="Titre" actif={etat.h1} onClick={() => chaine().toggleHeading({ level: 1 }).run()} />
      <Bouton icone={Heading2} titre="Sous-titre (article)" actif={etat.h2} onClick={() => chaine().toggleHeading({ level: 2 }).run()} />
      <Bouton icone={Pilcrow} titre="Texte normal" onClick={() => chaine().setParagraph().run()} />
      <Separateur />
      <Bouton icone={Bold} titre="Gras" actif={etat.gras} onClick={() => chaine().toggleBold().run()} />
      <Bouton icone={Italic} titre="Italique" actif={etat.italique} onClick={() => chaine().toggleItalic().run()} />
      <Bouton icone={Underline} titre="Souligné" actif={etat.souligne} onClick={() => chaine().toggleUnderline().run()} />
      <Separateur />
      <Bouton icone={List} titre="Liste à puces" actif={etat.puces} onClick={() => chaine().toggleBulletList().run()} />
      <Bouton icone={ListOrdered} titre="Liste numérotée" actif={etat.numeros} onClick={() => chaine().toggleOrderedList().run()} />
      <Separateur />
      <Bouton icone={AlignLeft} titre="Aligner à gauche" onClick={() => chaine().setTextAlign("left").run()} />
      <Bouton icone={AlignCenter} titre="Centrer" actif={etat.centre} onClick={() => chaine().setTextAlign("center").run()} />
      <Bouton icone={AlignJustify} titre="Justifier" actif={etat.justifie} onClick={() => chaine().setTextAlign("justify").run()} />
      <Separateur />
      <Bouton icone={Undo2} titre="Annuler" desactive={!etat.annuler} onClick={() => chaine().undo().run()} />
      <Bouton icone={Redo2} titre="Rétablir" desactive={!etat.retablir} onClick={() => chaine().redo().run()} />

      {avecChamps && (
        <select
          aria-label="Insérer un champ automatique"
          className="ml-auto h-9 max-w-56 rounded-lg border border-bordure bg-surface px-2 text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value) chaine().insertContent(`{{${e.target.value}}}`).run();
          }}
        >
          <option value="">+ Insérer un champ…</option>
          {(["Entreprise", "Salarié", "Contrat", "Autres"] as const).map((groupe) => (
            <optgroup key={groupe} label={groupe}>
              {CHAMPS_DOCUMENT.filter((c) => c.groupe === groupe).map((c) => (
                <option key={c.cle} value={c.cle}>
                  {c.libelle}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      {avecImportWord && <ImportWord editeur={editeur} />}
    </div>
  );
}

// Import d'un document Word (.docx) : converti en texte mis en forme dans l'éditeur.
function ImportWord({ editeur }: { editeur: Editor }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  async function importer(fichier: File | undefined) {
    setErreur(null);
    if (!fichier) return;
    if (!fichier.name.toLowerCase().endsWith(".docx")) return setErreur("Choisissez un fichier Word .docx (Fichier → Enregistrer sous → Document Word).");
    if (fichier.size > 10 * 1024 * 1024) return setErreur("Fichier trop lourd (10 Mo maximum).");
    if (editeur.getText().trim() && !window.confirm("Le texte actuel sera remplacé par celui du document Word. Continuer ?")) return;
    setEnCours(true);
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await fichier.arrayBuffer() });
      editeur.commands.setContent(value, { emitUpdate: true });
    } catch {
      setErreur("Le document Word n'a pas pu être lu.");
    } finally {
      setEnCours(false);
      if (champ.current) champ.current.value = "";
    }
  }

  return (
    <span className={`flex items-center gap-2 ${erreur ? "w-full" : ""}`}>
      <label className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-bordure px-3 text-sm font-medium hover:bg-black/[.03] ${enCours ? "pointer-events-none opacity-60" : ""}`}>
        {enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <FileUp size={14} aria-hidden />}
        Importer un Word
        <input ref={champ} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => importer(e.target.files?.[0])} />
      </label>
      {erreur && <span className="text-xs text-red-700">{erreur}</span>}
    </span>
  );
}

function Bouton({ icone: Icone, titre, actif, desactive, onClick }: { icone: LucideIcon; titre: string; actif?: boolean; desactive?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      aria-pressed={actif}
      disabled={desactive}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-lg text-foreground transition-colors disabled:opacity-40 ${actif ? "bg-marque-claire text-marque" : "hover:bg-black/[.05]"}`}
    >
      <Icone size={16} aria-hidden />
    </button>
  );
}

function Separateur() {
  return <span className="mx-1 h-6 w-px bg-bordure" aria-hidden />;
}
