import { ImageResponse } from "next/og";
import { lireTailleIcone, logoSvg } from "@/lib/portail/application";

// Icônes de l'application salarié (écran d'accueil du téléphone), dessinées à partir du logo.
export async function GET(requete: Request, { params }: RouteContext<"/icone-salarie/[taille]">) {
  const taille = lireTailleIcone((await params).taille);
  if (!taille) return new Response("Taille inconnue.", { status: 404 });
  const variante = new URL(requete.url).searchParams.get("variante") === "masquable" ? "masquable" : "standard";
  const source = `data:image/svg+xml;base64,${Buffer.from(logoSvg(variante)).toString("base64")}`;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur
      <img src={source} width={taille} height={taille} alt="" />
    ),
    { width: taille, height: taille, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
