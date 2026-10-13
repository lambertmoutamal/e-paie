import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";
import { COOKIE_ENTREPRISE, exigeEntrepriseChoisie } from "@/lib/entreprise-chemins";

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
  const motDePasseADefinir = data?.claims?.app_metadata?.mot_de_passe_a_definir === true;
  const salarie = data?.claims?.app_metadata?.type === "salarie";
  const chemin = requete.nextUrl.pathname;
  const pagePortail = chemin === "/portail" || chemin.startsWith("/portail/");
  const connexionPortail = chemin === "/portail/connexion";

  // Portail salarié (connexion par téléphone)
  if (pagePortail) {
    if (!connecte && !connexionPortail) return rediriger(requete, reponse, "/portail/connexion");
    if (connecte && salarie && connexionPortail) return rediriger(requete, reponse, "/portail");
    if (connecte && !salarie && !connexionPortail) return rediriger(requete, reponse, "/espace");
    return reponse;
  }

  // Espace du personnel, y compris l'écran de choix de l'entreprise (hors du cadre de l'espace)
  const pagePersonnel = chemin.startsWith("/espace") || chemin === "/choix-entreprise";

  // Un compte salarié n'entre jamais dans l'espace du personnel.
  if (connecte && salarie && (pagePersonnel || chemin === "/connexion")) {
    return rediriger(requete, reponse, "/portail");
  }
  if (!connecte && pagePersonnel) {
    return rediriger(requete, reponse, "/connexion");
  }
  if (connecte && chemin === "/connexion") {
    return rediriger(requete, reponse, "/espace");
  }
  // Compte tout juste activé (ou mot de passe oublié) : il faut d'abord choisir un mot de passe.
  if (motDePasseADefinir && pagePersonnel && chemin !== "/espace/mot-de-passe") {
    return rediriger(requete, reponse, "/espace/mot-de-passe");
  }
  // Une seule entreprise à la fois : elle se choisit d'abord (les pages vérifient ensuite
  // que l'entreprise mémorisée est bien accessible).
  if (connecte && exigeEntrepriseChoisie(chemin) && !requete.cookies.get(COOKIE_ENTREPRISE)?.value) {
    return rediriger(requete, reponse, "/choix-entreprise");
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
  matcher: ["/espace/:path*", "/choix-entreprise", "/connexion", "/portail", "/portail/:path*"],
};
