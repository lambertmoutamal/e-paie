import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

// Exécuté avant chaque page : rafraîchit la session et protège l'espace privé.
export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });
  const { url, cle } = configSupabase();

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(cookiesAEcrire) {
        for (const { name, value } of cookiesAEcrire) requete.cookies.set(name, value);
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of cookiesAEcrire) {
          reponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const connecte = Boolean(data?.claims?.sub);
  const chemin = requete.nextUrl.pathname;

  if (!connecte && chemin.startsWith("/espace")) {
    return rediriger(requete, reponse, "/connexion");
  }
  if (connecte && chemin === "/connexion") {
    return rediriger(requete, reponse, "/espace");
  }
  return reponse;
}

// La redirection garde les cookies de session éventuellement rafraîchis.
function rediriger(requete: NextRequest, reponse: NextResponse, chemin: string) {
  const redirection = NextResponse.redirect(new URL(chemin, requete.url));
  for (const cookie of reponse.cookies.getAll()) redirection.cookies.set(cookie);
  return redirection;
}

export const config = {
  matcher: ["/espace/:path*", "/connexion"],
};
