# Plan de développement — DématPaie, phase 1

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
| 4 ter | Paiement Mobile Money (Genuka Pay) — *en attente de la clé secrète Genuka ; Chariow à l'étude* |
| 5 | Salariés et import Excel |
| — | Organisation par modules, site vitrine (accueil, experts-comptables, demande de démo) |
| 6 | Contrats, avenants, renouvellements, documents du salarié (stockage privé), échéances, salariés prévisionnels, import Excel des contrats |
| 7 | Périodes de paie, dépôt des bulletins PDF un par un, en masse, ou en un seul PDF découpé automatiquement (reconnaissance du matricule sur chaque page), contrôle du contenu, empreinte SHA-256, stockage privé |
| 8 | Circuit de validation configurable par entreprise (1 à 5 étapes), séparation des tâches, refus commenté, approbation et verrouillage, historique |
| 9 | Publication des bulletins, **portail salarié** : connexion par code SMS ou WhatsApp (Twilio Verify), bulletins et historique |
| — | Alertes de paie par email et WhatsApp, actions « À faire » visibles par la seule personne qui doit agir |
| 10 | Congés et permissions : demandes depuis le portail (justificatif), validation RH, soldes calculés automatiquement, jours fériés, planning, alertes |
| — | Congés prévisionnels ; contrats : import du document signé ou rédaction dans DématPaie (modèles, import Word, champs automatiques, PDF) |
| — | Réglages personnalisables des congés (types, ancienneté, règles, qui valide), date du dernier congé |
| 11 | Réclamations : ouverture depuis le portail (sujet, bulletin, pièce jointe), échanges, résolution et clôture, traitement selon le sujet, alertes |

## À venir

| Étape | Module | Contenu |
|---|---|---|
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
