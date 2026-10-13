import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DématPaie",
    template: "%s · DématPaie",
  },
  description:
    "Plateforme de paie zéro papier pour les cabinets comptables et les entreprises.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f5132",
};

// Pas de police téléchargée : on utilise celles du téléphone,
// pour que les pages restent légères sur une connexion lente.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      {/* Certaines extensions du navigateur (antivirus, bloqueurs) ajoutent des attributs à <body>
          avant le chargement : on ignore ces seules différences (le contenu reste contrôlé). */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
