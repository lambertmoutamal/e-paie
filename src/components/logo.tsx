// Logo e-Paie : un bulletin stylisé dans un carré aux couleurs de la marque.
export function Logo({ taille = 32, avecNom = true, clair = false }: { taille?: number; avecNom?: boolean; clair?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={taille} height={taille} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={clair ? "#ffffff" : "var(--marque)"} />
        <path d="M10 8h9l4 4v12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill={clair ? "var(--marque)" : "#ffffff"} />
        <path d="M12 15h8M12 18.5h8M12 22h5" stroke={clair ? "#ffffff" : "var(--marque)"} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="23" cy="9" r="3" fill="var(--accent)" />
      </svg>
      {avecNom && (
        <span className={`text-lg font-bold tracking-tight ${clair ? "text-white" : "text-foreground"}`}>
          e-Paie
        </span>
      )}
    </span>
  );
}
