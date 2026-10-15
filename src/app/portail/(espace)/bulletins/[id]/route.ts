import { NextResponse, type NextRequest } from "next/server";
import { clientSupabaseServeur } from "@/lib/supabase/serveur";
import { libellePeriode } from "@/lib/bulletins/regles";

// Ouvre un bulletin du salarié connecté : la base ne renvoie le fichier que s'il
// s'agit de SON bulletin et qu'il est publié ; lien temporaire de 60 secondes.
// Le téléchargement vaut émargement (accusé de réception) : il est enregistré avant
// l'envoi du fichier, une seule fois (le premier téléchargement fait foi).
export async function GET(requete: NextRequest, { params }: RouteContext<"/portail/bulletins/[id]">) {
  const { id } = await params;
  const supabase = await clientSupabaseServeur();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return NextResponse.redirect(new URL("/portail/connexion", requete.url));

  const [{ data: chemin }, { data: bulletins }] = await Promise.all([
    supabase.rpc("fichier_de_mon_bulletin", { p_bulletin_id: id }),
    supabase.rpc("mes_bulletins"),
  ]);
  const infos = (bulletins as { bulletin_id: string; annee: number; mois: number }[] | null)?.find((b) => b.bulletin_id === id);
  if (typeof chemin !== "string" || !infos) return new NextResponse("Bulletin introuvable.", { status: 404 });

  const { error: erreurEmargement } = await supabase.rpc("emarger_mon_bulletin", {
    p_bulletin_id: id,
    p_adresse_ip: requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    p_navigateur: requete.headers.get("user-agent"),
  });
  if (erreurEmargement) {
    console.error("Émargement impossible :", erreurEmargement.code, erreurEmargement.message);
    return new NextResponse("Le bulletin n'a pas pu être ouvert. Réessayez dans un instant.", { status: 503 });
  }

  const nom = `Bulletin ${libellePeriode(infos.annee, infos.mois)}.pdf`;
  const { data, error } = await supabase.storage.from("bulletins").createSignedUrl(chemin, 60, { download: nom });
  if (error || !data?.signedUrl) return new NextResponse("Bulletin introuvable.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
