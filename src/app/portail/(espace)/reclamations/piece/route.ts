import { NextResponse, type NextRequest } from "next/server";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { utilisateurConnecte } from "@/lib/auth/connecte";

// Ouvre une pièce jointe d'une réclamation du salarié connecté : la base n'autorise
// que les fichiers de son propre dossier ; lien temporaire de 60 secondes.
export async function GET(requete: NextRequest) {
  const chemin = requete.nextUrl.searchParams.get("chemin");
  if (!chemin || chemin.includes("..")) return new NextResponse("Fichier introuvable.", { status: 404 });
  const supabase = await clientSupabaseServeur();
  const session = { user: await utilisateurConnecte(supabase) };
  if (!session.user) return NextResponse.redirect(new URL("/portail/connexion", requete.url));
  const { data, error } = await supabase.storage.from("reclamations").createSignedUrl(chemin, 60);
  if (error || !data?.signedUrl) return new NextResponse("Fichier introuvable.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
