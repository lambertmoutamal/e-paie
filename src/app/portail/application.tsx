"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// Enregistre le service de l'application (installation, page « hors connexion »).
export function EnregistrementApplication() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-salarie.js", { scope: "/portail" }).catch(() => {
        // Sans service (navigateur ancien, navigation privée) : le site reste utilisable normalement
      });
    }
  }, []);
  return null;
}

type InvitationInstallation = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Bouton « Installer l'application » (Android, ordinateur) ou marche à suivre (iPhone).
// Rien ne s'affiche si l'application est déjà installée ou si le navigateur ne le permet pas.
export function BoutonInstallation() {
  const [invitation, setInvitation] = useState<InvitationInstallation | null>(null);
  const [iphone, setIphone] = useState(false);
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    const installee = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone);
    if (installee) return;
    const surIphone = /iPhone|iPad|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const proposer = (e: Event) => {
      e.preventDefault(); // on affiche notre propre bouton
      setInvitation(e as InvitationInstallation);
    };
    window.addEventListener("beforeinstallprompt", proposer);
    // Lecture de l'appareil après l'affichage (évite un écart avec le rendu du serveur)
    const minuteur = setTimeout(() => setIphone(surIphone), 0);
    return () => {
      window.removeEventListener("beforeinstallprompt", proposer);
      clearTimeout(minuteur);
    };
  }, []);

  if (masque || (!invitation && !iphone)) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-marque/20 bg-marque-claire/60 px-4 py-3 text-sm text-marque-nuit">
      {invitation ? (
        <>
          <Download size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <span>Installez l&apos;application DématPaie sur votre téléphone pour retrouver vos bulletins en un geste.</span>
            <button
              type="button"
              onClick={async () => {
                await invitation.prompt();
                await invitation.userChoice;
                setInvitation(null);
              }}
              className="h-9 rounded-lg bg-marque px-3 font-semibold text-white"
            >
              Installer l&apos;application
            </button>
          </div>
        </>
      ) : (
        <>
          <Share size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span className="flex-1">
            Pour installer l&apos;application sur votre iPhone : touchez <strong>Partager</strong> en bas de Safari, puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
          </span>
        </>
      )}
      <button type="button" onClick={() => setMasque(true)} aria-label="Masquer" className="shrink-0 rounded p-0.5 text-marque-nuit/70 hover:text-marque-nuit">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
