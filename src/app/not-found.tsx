import Link from "next/link";

export default function PageIntrouvable() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-foreground/70">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link href="/" className="rounded-lg bg-marque px-4 py-2 font-medium text-white">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
