import type { Metadata, Viewport } from "next";
import { COULEUR_MARQUE } from "@/lib/portail/application";
import { EnregistrementApplication } from "./application";

// Espace salarié = application installable « DématPaie Salarié » (écran d'accueil du téléphone).
// Ces réglages ne concernent que les pages /portail : l'espace employeur reste un site classique.
export const metadata: Metadata = {
  manifest: "/salarie.webmanifest",
  applicationName: "DématPaie Salarié",
  appleWebApp: { capable: true, title: "DématPaie", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/logo-dematpaie.svg", type: "image/svg+xml" }, { url: "/icone-salarie/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icone-salarie/180", sizes: "180x180", type: "image/png" }],
  },
};

// viewportFit « cover » : la barre du bas tient compte de la zone de sécurité des téléphones (encoche, barre de gestes)
export const viewport: Viewport = { themeColor: COULEUR_MARQUE, viewportFit: "cover" };

export default function MiseEnPageApplication({ children }: LayoutProps<"/portail">) {
  return (
    <>
      {children}
      <EnregistrementApplication />
    </>
  );
}
