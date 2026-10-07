// Supabase renvoie une table liée sous forme d'objet ou de liste selon le cas.
export function valeurLiee(lie: unknown, champ: string): string | null {
  const objet = (Array.isArray(lie) ? lie[0] : lie) as Record<string, string | null> | null;
  return objet?.[champ] ?? null;
}

// Variante pour l'affichage : « — » quand la valeur est absente.
export function champLie(lie: unknown, champ: string): string {
  return valeurLiee(lie, champ) ?? "—";
}
