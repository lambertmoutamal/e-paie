import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Envoi de fichiers (contrats signés, documents) : 5 Mo maximum + marge du formulaire
    serverActions: { bodySizeLimit: "6mb" },
  },
  partialPrefetching: true,
  // Protections du navigateur sur toutes les pages : pas d'affichage dans le cadre d'un autre site
  // (vol de clics), pas de devinette du type de fichier, adresse d'origine limitée, https imposé.
  // Service de l'application salarié : toujours la dernière version (pas de cache).
  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      { source: "/sw-salarie.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  // Générateur de PDF des contrats : chargé tel quel par Node (il lit ses fichiers de police)
  serverExternalPackages: ["pdfmake"],
  outputFileTracingIncludes: { "/**": ["./node_modules/pdfmake/fonts/Roboto/*.ttf"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
