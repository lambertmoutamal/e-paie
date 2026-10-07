import Link from "next/link";

type Espace = { titre: string; texte: string; lien?: string };

const espaces: Espace[] = [
  {
    titre: "Espace salarié",
    texte: "Consultez vos bulletins, demandez un congé ou déposez une réclamation.",
  },
  {
    titre: "Espace cabinet / entreprise",
    texte: "Gérez vos entreprises, vos salariés et la publication des bulletins.",
    lien: "/connexion",
  },
];

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-marque">e-Paie</p>
        <h1 className="text-2xl font-bold leading-tight">La paie zéro papier</h1>
        <p className="text-base text-foreground/70">
          Vos bulletins de paie, vos congés et vos échanges avec l&apos;employeur, au même
          endroit, depuis votre téléphone.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {espaces.map((espace) => (
          <li
            key={espace.titre}
            className="rounded-xl border border-black/10 bg-white p-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold">{espace.titre}</h2>
            <p className="mt-1 text-sm text-foreground/70">{espace.texte}</p>
            {espace.lien ? (
              <Link
                href={espace.lien}
                className="mt-3 inline-block rounded-lg bg-marque px-4 py-2 text-sm font-semibold text-white"
              >
                Se connecter
              </Link>
            ) : (
              <p className="mt-3 inline-block rounded-full bg-marque-claire px-3 py-1 text-xs font-medium text-marque">
                Disponible prochainement
              </p>
            )}
          </li>
        ))}
      </ul>

      <footer className="mt-auto text-center text-xs text-foreground/50">
        Libreville, Gabon
      </footer>
    </main>
  );
}
