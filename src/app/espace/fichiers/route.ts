import { NextResponse, type NextRequest } from "next/server";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { COMPARTIMENT } from "@/lib/stockage/fichiers";

// Ouvre un fichier de l'espace privé : un lien temporaire (60 secondes) est créé
// au nom de la personne connectée ; la base refuse si elle n'a pas accès à l'entreprise.
export async function GET(requete: NextRequest) {
  const chemin = requete.nextUrl.searchParams.get("chemin");
  if (!chemin || chemin.includes("..")) return new NextResponse("Fichier introuvable.", { status: 404 });

  const supabase = await clientSupabaseServeur();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return NextResponse.redirect(new URL("/connexion", requete.url));

  const { data, error } = await supabase.storage.from(COMPARTIMENT).createSignedUrl(chemin, 60);
  if (error || !data?.signedUrl) return new NextResponse("Fichier introuvable ou accès refusé.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
