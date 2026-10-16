import { manifesteSalarie } from "@/lib/portail/application";

// Manifeste de l'application installable de l'espace salarié (lié seulement par ses pages).
export function GET() {
  return Response.json(manifesteSalarie(), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
