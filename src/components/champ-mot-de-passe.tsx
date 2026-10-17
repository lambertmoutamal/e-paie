"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

// Champ de mot de passe avec un bouton « Afficher / Masquer » (44 px, annoncé aux lecteurs d'écran).
// Le champ garde son nom et ses attributs : seul le type bascule entre « password » et « text ».
export function SaisieMotDePasse({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12!`} autoCapitalize="none" spellCheck={false} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid min-h-11 w-11 cursor-pointer place-items-center rounded-lg text-doux hover:text-marque"
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
