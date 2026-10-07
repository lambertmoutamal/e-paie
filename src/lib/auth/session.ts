// Les cookies de session Supabase s'appellent « sb-<projet>-auth-token »,
// éventuellement découpés en morceaux « .0 », « .1 »… quand la session est longue.
export function estCookieDeSession(nom: string): boolean {
  return /^sb-[a-z0-9]+-auth-token(\.\d+)?$/.test(nom);
}
