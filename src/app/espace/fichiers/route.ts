import { NextResponse, type NextRequest } from "next/server";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { COMPARTIMENT } from "@/lib/stockage/fichiers";

// Seuls ces espaces de stockage privés peuvent être ouverts par ce lien.
const COMPARTIMENTS_AUTORISES = new Set([COMPARTIMENT, "bulletins"]);

// Ouvre un fichier de l'espace privé : un lien temporaire (60 secondes) est créé
// au nom de la personne connectée ; la base refuse si elle n'a pas accès à l'entreprise.
export async function GET(requete: NextRequest) {
  const chemin = requete.nextUrl.searchParams.get("chemin");
  const compartiment = requete.nextUrl.searchParams.get("espace") ?? COMPARTIMENT;
  if (!chemin || chemin.includes("..") || !COMPARTIMENTS_AUTORISES.has(compartiment)) {
    return new NextResponse("Fichier introuvable.", { status: 404 });
  }

  const supabase = await clientSupabaseServeur();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return NextResponse.redirect(new URL("/connexion", requete.url));

  const { data, error } = await supabase.storage.from(compartiment).createSignedUrl(chemin, 60);
  if (error || !data?.signedUrl) return new NextResponse("Fichier introuvable ou accès refusé.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
