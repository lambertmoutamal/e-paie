export const LIBELLES_ROLES: Record<string, string> = {
  admin_plateforme: "Administrateur plateforme",
  admin_cabinet: "Administrateur cabinet",
  admin_entreprise: "Administrateur entreprise",
  gestionnaire_paie: "Gestionnaire de paie",
  controleur: "Contrôleur",
  signataire: "Signataire final",
  rh: "Responsable RH / employeur",
};

export function libelleRole(role: string) {
  return LIBELLES_ROLES[role] ?? role;
}
