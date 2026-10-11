import "server-only";
import { cache } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import type { MotifAlerte } from "@/lib/notifications/messages-paie";

export type ActionPaie = {
  periode_id: string;
  entreprise_id: string;
  raison_sociale: string;
  annee: number;
  mois: number;
  action: MotifAlerte;
  libelle_etape: string;
  depuis: string;
  commentaire: string | null;
};

// Actions de paie qui attendent la personne connectée (lues une fois par requête).
// La base applique les mêmes règles que le circuit (rôle, séparation des tâches).
export const mesActionsPaie = cache(async (): Promise<ActionPaie[]> => {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.rpc("mes_actions_paie");
  return (data ?? []) as ActionPaie[];
});

export type DemandeATraiter = {
  demande_id: string;
  entreprise_id: string;
  raison_sociale: string;
  salarie: string;
  type_libelle: string;
  debut: string;
  fin: string;
  nb_jours: number;
  cree_le: string;
  prevalidee: boolean;
};

// Demandes d'absence que la personne connectée doit traiter (RH, ou administrateur s'il n'y a pas de RH).
export const mesDemandesATraiter = cache(async (): Promise<DemandeATraiter[]> => {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.rpc("mes_demandes_a_traiter");
  return (data ?? []) as DemandeATraiter[];
});
