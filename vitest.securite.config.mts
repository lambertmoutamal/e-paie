import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// Tests de sécurité : ils interrogent la vraie base Supabase de développement
// (dans des transactions annulées), d'où des délais plus longs.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/securite/**/*.test.ts"],
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
