// Supabase renvoie une table liée sous forme d'objet ou de liste selon le cas.
export function champLie(lie: unknown, champ: string): string {
  const objet = (Array.isArray(lie) ? lie[0] : lie) as Record<string, string | null> | null;
  return objet?.[champ] ?? "—";
}
