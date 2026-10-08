import "server-only";
import { signerRequete, statutDepuisGenuka } from "./signature-genuka";
import type { StatutPaiement } from "./regles";

// Client de l'API Genuka Pay (https://pay.genuka.com/fr/docs).
// Les clés sont lues dans .env.local ; la clé secrète ne quitte jamais le serveur.

function configuration() {
  const url = process.env.GENUKA_API_URL;
  const clePublique = process.env.GENUKA_PUBLIC_KEY;
  const cleSecrete = process.env.GENUKA_SECRET_KEY;
  if (!url || !clePublique || !cleSecrete) {
    throw new Error("Paiement non configuré : GENUKA_API_URL, GENUKA_PUBLIC_KEY ou GENUKA_SECRET_KEY manquant.");
  }
  return { url: url.replace(/\/$/, ""), clePublique, cleSecrete };
}

export class ErreurPrestataire extends Error {
  constructor(public statut: number, public details: string) {
    super(`Genuka Pay a répondu ${statut}`);
  }
}

async function appeler<T>(methode: "GET" | "POST", chemin: string, donnees?: unknown): Promise<T> {
  const { url, clePublique, cleSecrete } = configuration();
  const corps = donnees === undefined ? "" : JSON.stringify(donnees);
  const horodatage = Math.floor(Date.now() / 1000).toString();

  const reponse = await fetch(`${url}${chemin}`, {
    method: methode,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Public-Key": clePublique,
      "X-Timestamp": horodatage,
      "X-Signature": signerRequete(cleSecrete, horodatage, methode, chemin, corps),
    },
    body: methode === "POST" ? corps : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const texte = await reponse.text();
  if (!reponse.ok) throw new ErreurPrestataire(reponse.status, texte.slice(0, 500));
  const json = JSON.parse(texte);
  return (json?.data ?? json) as T;
}

export type PaiementCree = {
  reference: string | null;
  suivi: string;
  statut: StatutPaiement;
  urlRedirection: string | null;
};

export async function creerPaiement(p: {
  montant: number;
  devise: string;
  telephone: string;
  referenceInterne: string;
  description: string;
  nomClient: string;
  urlRetour: string;
}): Promise<PaiementCree> {
  const r = await appeler<{ id?: string; track_id?: string; reference?: string; status?: string; redirect_url?: string | null }>(
    "POST",
    "/api/v1/payments",
    {
      amount: p.montant,
      currency: p.devise,
      payer_phone: p.telephone,
      external_id: p.referenceInterne,
      return_url: p.urlRetour,
      cancel_url: p.urlRetour,
      metadata: { external_id: p.referenceInterne, description: p.description, customer_name: p.nomClient },
    },
  );
  const suivi = r.track_id ?? r.reference ?? r.id;
  if (!suivi) throw new ErreurPrestataire(200, "Réponse sans identifiant de suivi.");
  return { reference: r.id ?? null, suivi, statut: statutDepuisGenuka(r.status), urlRedirection: r.redirect_url ?? null };
}

export async function consulterPaiement(suivi: string): Promise<{ statut: StatutPaiement; reference: string | null; erreur: string | null }> {
  const r = await appeler<{ status?: string; transaction_id?: string; failure?: unknown }>(
    "GET",
    `/api/v1/payments/status/${encodeURIComponent(suivi)}`,
  );
  return {
    statut: statutDepuisGenuka(r.status),
    reference: r.transaction_id ?? null,
    erreur: r.failure ? JSON.stringify(r.failure).slice(0, 300) : null,
  };
}
