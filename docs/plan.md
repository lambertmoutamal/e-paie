# Plan de développement — e-Paie, phase 1

Chaque étape se termine par : explication, procédure de test, tests automatiques, commit.
Les décisions métier sont consignées dans [decisions.md](decisions.md).
Organisation des modules inspirée des SIRH du marché (référence : Nibelis), adaptée à nos pays cibles.

## Fait

| Étape | Contenu |
|---|---|
| 0 | Préparation du poste (Node.js, Git, Python) |
| 1 | Squelette Next.js + Tailwind, README |
| 2 | Fondations multi-clients et isolation (RLS) |
| 3 | Connexion du personnel, journal d'audit infalsifiable |
| 4 | Administration : cabinets, entreprises, utilisateurs et rôles, invitations par email |
| 4 bis | Inscription libre, essai gratuit, abonnements (lecture seule puis blocage) |
| 4 ter | Paiement Mobile Money (Genuka Pay) — *en attente de la clé secrète Genuka* |
| 5 | Salariés et import Excel |
| — | Organisation par modules, site vitrine (accueil, experts-comptables, demande de démo) |

## À venir

| Étape | Module | Contenu |
|---|---|---|
| 6 | Gestion administrative | Contrats (CDI, CDD…), avenants, PDF signé, documents du salarié, **alertes de fin de CDD et de période d'essai**, **salariés prévisionnels** (embauches à venir) |
| 7 | Bulletins & coffre-fort | Périodes de paie, dépôt des bulletins PDF (unitaire et en masse), stockage privé |
| 8 | Bulletins & coffre-fort | Circuit de validation configurable (séparation des tâches, refus commenté, verrouillage) |
| 9 | Self-service | Publication et **portail salarié** : connexion par téléphone, bulletins, historique |
| 10 | Congés & absences | Demandes de congé et de permission, validation RH, soldes |
| 11 | Self-service | Réclamations avec échanges et statut |
| 12 | Transversal | Notifications dans l'application et par email ; prévenance des salariés avant blocage |
| 13 | Self-service | **Espace manager** : vue de son équipe, validation des absences de ses collaborateurs |
| 14 | Notes de frais | Saisie depuis le téléphone avec photo du justificatif, validation par le manager, suivi |
| 15 | Pilotage | **Tableaux de bord et rapports** : effectifs, entrées et sorties, absences ; exports Excel |
| 16 | Transversal | Durcissement : double authentification des rôles sensibles, revue de sécurité, tests de bout en bout |
| 17 | Transversal | Mise en ligne pour les clients pilotes (domaine, HTTPS, webhook Genuka, réputation email) |

## Phases suivantes

- **Phase 2** : calcul de la paie (rubriques, taux et plafonds paramétrables), génération des bulletins,
  signature numérisée, génération des contrats depuis des modèles.
- **Phase 3** : états de déclarations sociales et fiscales, calendrier des échéances.
- **Phase 4** : signature électronique certifiée, application mobile, intégrations.
