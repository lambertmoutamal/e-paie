import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "e-Paie",
    template: "%s · e-Paie",
  },
  description:
    "Plateforme de paie zéro papier pour les cabinets comptables et les entreprises du Gabon.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
