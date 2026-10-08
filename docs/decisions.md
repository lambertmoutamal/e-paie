# Journal des décisions

Décisions métier et techniques validées par le porteur du projet. Chaque entrée indique
ce qui a été décidé, quand, et ce que cela change par rapport au cahier des charges.

## 2026-10-07 — Fondations (phase 1)

- Circuit de validation inclus en phase 1, appliqué au dépôt des bulletins PDF.
- Rôle « administrateur plateforme » ajouté.
- Dépôt en masse : fichiers PDF nommés par matricule (ex. `0123_2026-10.pdf`).
- Contrats : registre et dépôt du PDF signé (génération de contrats en phase 2).
- Base de développement : projet Supabase en ligne (pas de Docker).

## 2026-10-07 — Comptes utilisateurs

- Les comptes sont créés par **invitation email avec lien d'activation** : aucun mot de passe
  n'est envoyé ; la personne choisit le sien après avoir prouvé que la boîte mail lui appartient.
- Emails envoyés via Resend depuis le domaine `synergieplusgabon.com`.
- La plateforme ne mentionne plus de pays dans ses textes (ouverture à d'autres pays).

## 2026-10-08 — Inscription libre et abonnements

- Les prospects (cabinets et entreprises) peuvent **s'inscrire seuls** : essai gratuit de 30 jours,
  ou choix de la formule Pro (essai puis abonnement, l'équipe recontacte le prospect).
- Le paiement en ligne (Mobile Money, carte) sera ajouté quand le prestataire et les tarifs
  seront choisis. En attendant, l'administrateur plateforme active les abonnements à la main.
- Prix des formules : 0 pour l'instant, modifiables par l'administrateur plateforme.
- Nouveau rôle « administrateur entreprise » pour les entreprises inscrites seules (mode autonome).
- **Fin d'essai ou d'abonnement** : 30 jours de **lecture seule** (consultation et export),
  puis **blocage total, salariés compris**.
  > ⚠️ **Modifie le cahier des charges, section 4**, qui prévoyait que le salarié conserve
  > l'accès à son historique de bulletins même si l'entreprise met fin à son abonnement.
  > À prévoir avec le module salariés : un email de prévenance aux salariés avant le blocage,
  > pour qu'ils téléchargent leurs bulletins.
- Les structures créées par l'administrateur plateforme (sans abonnement) ne sont pas limitées.

## 2026-10-08 — Paiement en ligne

- Prestataire retenu : **Genuka Pay** (Mobile Money : Airtel, Moov, MTN, Orange ; 12 pays en
  zones XAF et XOF ; 3 % + 25 FCFA par paiement réussi). Pas de carte bancaire : un second
  prestataire pourra être ajouté plus tard grâce à un adaptateur.
- Durées proposées : **mensuel** et **annuel**, l'annuel avec **2 mois offerts** (10 × le prix mensuel).

## 2026-10-08 — Outils de design

- Installation des skills **UI/UX Pro Max** (nextlevelbuilder, licence MIT) dans `.claude/skills`,
  et de Python 3.13 pour leurs scripts. Inspectés avant ajout.
