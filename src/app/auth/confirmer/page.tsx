import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CadreAuth } from "@/components/cadre-auth";
import { Formulaire } from "@/components/formulaire";
import { confirmerLien } from "./actions";

export const metadata: Metadata = { title: "Activation du compte" };

// Le lien reçu par email ouvre cette page ; l'activation n'a lieu qu'au clic sur
// le bouton (les messageries qui « testent » les liens ne peuvent pas le consommer).
export default function PageConfirmer({ searchParams }: PageProps<"/auth/confirmer">) {
  return (
    <Suspense fallback={null}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token_hash, type } = await searchParams;
  const recuperation = type === "recovery";

  if (typeof token_hash !== "string" || typeof type !== "string") {
    return (
      <CadreAuth titre="Lien incomplet" description="Ouvrez le lien directement depuis l'email reçu, sans le modifier.">
        <Link href="/connexion" className="font-medium text-marque hover:underline">
          Aller à la connexion
        </Link>
      </CadreAuth>
    );
  }

  return (
    <CadreAuth
      titre={recuperation ? "Nouveau mot de passe" : "Activez votre compte"}
      description={
        recuperation
          ? "Cliquez sur le bouton pour confirmer votre demande, puis choisissez un nouveau mot de passe."
          : "Cliquez sur le bouton pour confirmer votre adresse email, puis choisissez votre mot de passe."
      }
    >
      <Formulaire action={confirmerLien} libelleBouton={recuperation ? "Continuer" : "Activer mon compte"}>
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
      </Formulaire>
    </CadreAuth>
  );
}
