import type { Metadata } from "next";
import Link from "next/link";
import { seConnecter } from "./actions";
import { FormulaireConnexion } from "./formulaire-connexion";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-marque">
          e-Paie
        </Link>
        <h1 className="text-2xl font-bold">Espace cabinet / entreprise</h1>
        <p className="text-foreground/70">Connectez-vous avec l&apos;email fourni par votre administrateur.</p>
      </header>

      <FormulaireConnexion action={seConnecter} />

      <p className="text-sm text-foreground/60">
        Vous êtes salarié ? L&apos;espace salarié, avec connexion par téléphone, arrive bientôt.
      </p>
    </main>
  );
}
