import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Envoi de fichiers (contrats signés, documents) : 5 Mo maximum + marge du formulaire
    serverActions: { bodySizeLimit: "6mb" },
  },
  partialPrefetching: true,
  // Service de l'application salarié : toujours la dernière version (pas de cache)
  async headers() {
    return [{ source: "/sw-salarie.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
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
