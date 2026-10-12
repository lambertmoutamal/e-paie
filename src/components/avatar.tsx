// Avatar aux initiales, d'une couleur stable propre à chaque personne (comme sur les SIRH du marché).
const COULEURS = [
  "bg-indigo-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-teal-500",
];

function couleur(nom: string) {
  let somme = 0;
  for (const c of nom) somme = (somme * 31 + c.charCodeAt(0)) % 997;
  return COULEURS[somme % COULEURS.length];
}

export function initiales(nom: string) {
  return nom
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");
}

const TAILLES = { petit: "size-9 text-sm", moyen: "size-12 text-base", grand: "size-20 text-2xl sm:size-24 sm:text-3xl" };

export function Avatar({ nom, taille = "moyen", contour }: { nom: string; taille?: keyof typeof TAILLES; contour?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${couleur(nom)} ${TAILLES[taille]} ${contour ? "ring-4 ring-white" : ""}`}
    >
      {initiales(nom)}
    </span>
  );
}
