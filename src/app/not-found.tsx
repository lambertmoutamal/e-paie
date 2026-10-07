import Link from "next/link";
import { SearchX } from "lucide-react";
import { classesBouton } from "@/components/ui";

export default function PageIntrouvable() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-marque-claire text-marque">
        <SearchX size={26} aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="max-w-sm text-doux">
        Cette page n&apos;existe pas, a été déplacée, ou vous n&apos;avez pas les droits pour la consulter.
      </p>
      <Link href="/" className={`${classesBouton("principal")} mt-2`}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
