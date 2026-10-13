import "server-only";
import { cache } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { entrepriseCourante } from "@/lib/entreprise-courante";
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

export type ReclamationATraiter = {
  reclamation_id: string;
  entreprise_id: string;
  raison_sociale: string;
  salarie: string;
  sujet: string;
  objet: string;
  derniere_activite: string;
};

// Réclamations qui attendent une réponse de la personne connectée (chargée de ce sujet).
export const mesReclamationsATraiter = cache(async (): Promise<ReclamationATraiter[]> => {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase.rpc("mes_reclamations_a_traiter");
  return (data ?? []) as ReclamationATraiter[];
});


export type TachesEntreprise = {
  actions: ActionPaie[];
  demandes: DemandeATraiter[];
  reclamations: ReclamationATraiter[];
  nombre: number;
  // Ce qui attend la personne dans ses autres entreprises (à traiter après avoir basculé)
  ailleurs: { entreprise_id: string; raison_sociale: string; nombre: number }[];
};

// Une seule entreprise à la fois : les tâches de l'entreprise de travail, et un simple
// décompte pour les autres.
export const mesTachesEntrepriseCourante = cache(async (): Promise<TachesEntreprise> => {
  const [courante, actions, demandes, reclamations] = await Promise.all([entrepriseCourante(), mesActionsPaie(), mesDemandesATraiter(), mesReclamationsATraiter()]);
  const ici = (x: { entreprise_id: string }) => x.entreprise_id === courante?.id;
  const ailleurs = new Map<string, { entreprise_id: string; raison_sociale: string; nombre: number }>();
  for (const x of [...actions, ...demandes, ...reclamations]) {
    if (ici(x)) continue;
    const e = ailleurs.get(x.entreprise_id) ?? { entreprise_id: x.entreprise_id, raison_sociale: x.raison_sociale, nombre: 0 };
    e.nombre += 1;
    ailleurs.set(x.entreprise_id, e);
  }
  const t = { actions: actions.filter(ici), demandes: demandes.filter(ici), reclamations: reclamations.filter(ici) };
  return { ...t, nombre: t.actions.length + t.demandes.length + t.reclamations.length, ailleurs: [...ailleurs.values()].sort((a, b) => a.raison_sociale.localeCompare(b.raison_sociale, "fr")) };
});
