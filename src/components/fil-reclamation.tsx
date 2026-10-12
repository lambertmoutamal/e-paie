import { Paperclip } from "lucide-react";

export type MessageFil = {
  id: string;
  de_salarie: boolean;
  auteur: string;
  contenu: string;
  piece_chemin: string | null;
  piece_nom: string | null;
  cree_le: string;
};

const HORODATAGE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Libreville" });

// Fil d'échange d'une réclamation, comme une conversation. « cote » indique qui regarde :
// ses propres messages sont alignés à droite.
export function FilReclamation({ messages, cote, lienPiece }: { messages: MessageFil[]; cote: "salarie" | "personnel"; lienPiece: (chemin: string) => string }) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const mien = (cote === "salarie") === m.de_salarie;
        return (
          <li key={m.id} className={`flex ${mien ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mien ? "rounded-br-sm bg-marque text-white" : "rounded-bl-sm border border-bordure bg-surface"}`}>
              <p className={`mb-1 text-xs font-semibold ${mien ? "text-white/80" : "text-doux"}`}>
                {m.auteur} · {HORODATAGE.format(new Date(m.cree_le))}
              </p>
              <p className="whitespace-pre-line">{m.contenu}</p>
              {m.piece_chemin && (
                <a
                  href={lienPiece(m.piece_chemin)}
                  target="_blank"
                  rel="noopener"
                  className={`mt-2 inline-flex items-center gap-1 font-medium underline ${mien ? "text-white" : "text-marque"}`}
                >
                  <Paperclip size={14} aria-hidden />
                  {m.piece_nom ?? "Pièce jointe"}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
