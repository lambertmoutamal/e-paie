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

## 2026-10-11 — Circuit de validation des bulletins

- **Nombre d’étapes libre** : chaque entreprise règle son circuit (1 à 5 étapes), chaque étape
  étant validée par un rôle (contrôleur, signataire, RH, administrateur de l’entreprise ou administrateurs).
  Sans réglage : Contrôle (contrôleur) puis Approbation (signataire).
- Le circuit est **figé dans la période** à l’envoi en validation : modifier le réglage ne change pas
  les périodes déjà en cours.
- Séparation des tâches : l’émetteur, les déposants de bulletins et le validateur d’une autre étape ne
  peuvent pas valider. Un refus (commentaire obligatoire) renvoie à l’étape précédente ; refusée à la
  première étape, la période revient en brouillon.

## 2026-10-11 — Publication et portail salarié

- Connexion des salariés par **code à 6 chiffres, par SMS ou WhatsApp, via Twilio Verify** (choix du
  salarié). Twilio est configuré dans Supabase : aucune clé dans le code.
- Le compte salarié est créé à la première connexion et rattaché aux fiches portant ce numéro.
  Changer le numéro sur la fiche détache l’ancien compte. Un salarié avec plusieurs employeurs voit tout.
- Le salarié garde l’accès à ses bulletins après son départ ; tout est coupé si l’abonnement est bloqué.
- Publication d’une période approuvée : administrateurs ou signataire.

## 2026-10-11 — Alertes de paie

- À chaque étape du circuit, les personnes qui doivent agir reçoivent un **email** et, si elles ont
  saisi leur numéro dans leur profil, un **message WhatsApp** (Twilio).
- Les actions en attente sont affichées en tête du tableau de bord et dans un bandeau sur toutes les pages.
- Le message ne s'affiche que chez **la personne qui doit agir** (validateur de l'étape en cours,
  publieur après approbation, gestionnaire après un refus), jamais chez les autres.
- Si personne ne peut valider une étape (rôle non attribué), seul un avertissement apparaît sur la
  page de la période ; la personne qui reçoit ensuite ce rôle est prévenue à ce moment-là.

## 2026-10-12 — Congés et absences

- **Solde calculé automatiquement** : solde de départ (saisi par le RH, sinon 0 à l'embauche)
  + jours acquis par mois complet (2 par défaut, réglable) − congés payés acceptés.
- Décompte en jours ouvrables (lundi-samedi, par défaut) ou ouvrés (lundi-vendredi), hors jours fériés
  saisis par l'entreprise ; demi-journées possibles.
- Types d'absence par défaut (congé payé, permissions, maladie, absence injustifiée) : valeurs
  indicatives, à adapter par chaque entreprise à sa convention collective.
- Les demandes sont traitées par le **RH** ; s'il n'y a pas de RH, par les administrateurs. Seule
  cette personne est alertée et voit la demande dans « À faire ». Le salarié est prévenu de la réponse.
- Un refus ou une annulation doit être motivé. Une demande qui dépasse le solde n'est pas bloquée :
  le RH voit l'avertissement et décide.
- **Congés prévisionnels** : le gestionnaire de paie (ainsi que le RH et les administrateurs) inscrit
  les dates de congé prévues. Statut « Prévu » : visible au planning et par le salarié, non déduit du
  solde, sans alerte. Le RH ou un administrateur les confirme : ils deviennent des absences acceptées.

## 2026-10-12 — Contrats : import ou rédaction dans DématPaie

- Deux possibilités pour chaque contrat ou avenant : **importer le document signé** (PDF ou photo),
  ou le **rédiger dans DématPaie** à partir d'un modèle.
- Modèles : 3 modèles standard fournis (CDI, CDD, avenant), génériques et **à faire valider par un
  juriste**, en lecture seule ; chaque entreprise les personnalise, crée les siens ou **importe ses
  modèles Word (.docx)**.
- Les champs `{{nom}}`, `{{poste}}`, `{{salaire_base}}`… sont remplis automatiquement ; une information
  manquante apparaît « [à compléter : …] ».
- Le texte est nettoyé par le serveur (mise en forme simple uniquement) puis converti en PDF, rangé dans
  le dossier du salarié. Un PDF importé (signé) n'est jamais remplacé par un PDF généré.
- Le document est **figé** (non modifiable) dès que le contrat signé est joint, que le contrat passe
  « En cours » ou sur demande ; toute modification passe ensuite par un avenant.

## 2026-10-12 — Réglages personnalisables des congés

- **Types d'absence** modifiables (nom, jours maximum, justificatif, déduit du solde, demandable).
- **Jours d'ancienneté** : X jours par an par tranche de N années de présence (plafond facultatif),
  acquis chaque mois (1/12 par mois).
- **Règles des demandes** : délai de prévenance (congés décomptés seulement, pas les permissions),
  solde négatif autorisé ou non (vérifié à la demande, à la décision, à la saisie RH et à la confirmation
  d'une prévision), report maximum à l'ouverture de chaque année de congés (mois réglable), l'excédent
  étant perdu.
- **Qui valide** : le RH (par défaut), les administrateurs, ou le RH puis un administrateur (deux
  personnes différentes). Seul un administrateur peut changer ce réglage.

## 2026-10-12 — Réclamations

- Traitement **selon le sujet** : bulletin de paie → gestionnaire de paie ; congés, contrat, attestation,
  autre → RH ; sans personne ayant ce rôle → administrateurs. Chacun ne voit que les réclamations de ses
  sujets (les administrateurs voient tout, mais n'ont « à faire » que s'il n'y a personne d'autre).
- Statuts : ouverte → en cours (après une réponse) → résolue (par l'entreprise) → close (confirmée par le
  salarié). Un message du salarié sur une réclamation résolue la rouvre.
- Le salarié peut rattacher un de ses bulletins publiés et joindre une photo ou un PDF ; l'entreprise peut
  joindre un document (bulletin corrigé, attestation).

## 2026-10-12 — Un bulletin = une page

- Chaque bulletin déposé doit tenir sur **une seule page** : contrôlé par le serveur pour tous les modes
  de dépôt (un par un, un PDF par salarié, PDF unique découpé).
- Dans le découpage d'un PDF unique, chaque page devient un bulletin distinct, sans jamais être regroupée ;
  une seconde page attribuée au même salarié est signalée et n'est pas envoyée. Un salarié ne peut donc
  pas recevoir la page d'un collègue.

## 2026-10-12 — Nouvelle interface

- Présentation inspirée de BambooHR (organisation de l'écran seulement, ni logo ni textes repris) :
  barre de navigation en haut, cloche des actions à faire, menu du compte, recherche d'un salarié,
  accueil en tuiles (À faire, qui est absent, anniversaires et ancienneté, échéances, modules),
  fiche salarié avec bandeau, avatar et coordonnées.
- Palette **indigo** (marque) et **corail** (accent), une couleur par module, avatars colorés.

## 2026-10-13 — Navigation par groupes, tableau de bord, états

- Barre du haut organisée en **groupes avec menus déroulants** (Salariés, Paie, Absences, Réclamations,
  États, Paramètres) et **sélecteur d'entreprise de travail** (mémorisé sur l'appareil).
- **Tableau de bord** : indicateurs clés (effectif, entrées, sorties, fins de CDD ; absentéisme, bulletins, demandes et réclamations retirés le 13/10,
  réclamations, fins de CDD) et graphiques (effectif et mouvements sur 12 mois, contrats, hommes/femmes,
  absences par type, réclamations par sujet).
- **États** exportables en Excel et imprimables en PDF : personnel, entrées et sorties, contrats et échéances,
  réclamations, congés du mois, absences par type, soldes de congés, registre des bulletins.
- **Livre de paie, DTS, DAS et soldes de tout compte** : produits à partir de l'**import Excel mensuel** des
  résultats de paie (choix de l'utilisateur) — prochaine étape ; il faudra un exemple du fichier du logiciel
  de paie et les modèles officiels de DTS et DAS.
- **Écran des entreprises à la connexion**, montré à tous (une ou plusieurs entreprises accessibles) : choix
  redemandé à chaque connexion ; possibilité de voir « toutes mes entreprises » ; changement possible depuis
  la barre du haut.
- **Tableau de bord sur un seul écran** (sans défilement sur ordinateur) : 8 indicateurs et 6 graphiques
  (effectif, **pyramide des âges**, contrats, hommes/femmes, absences par type, réclamations par sujet).
  La liste « À faire » a sa propre page, ouverte par la cloche.


## 2026-10-13 — Résultats de paie (import Excel mensuel) et états de paie

- Les montants de paie viennent de l'**Excel du logiciel de paie**, importé chaque mois dans la période
  (Paie → période → « Résultats de paie »). Une ligne par salarié, rattachée par le **matricule**.
  Les colonnes sont reconnues d'après leur titre (brut, CNSS, IRPP, net…) et la correspondance peut être
  corrigée avant l'envoi ; toute autre colonne chiffrée est gardée comme « rubrique ».
- Un nouvel import **remplace** les lignes des mêmes salariés. Import et suppression possibles seulement
  par ceux qui déposent les bulletins, et seulement tant que la période est **en brouillon**.
- États produits : **livre de paie** (mensuel, avec coût employeur et rubriques), **soldes de tout compte**
  (salariés sortis dans le mois + **reçu imprimable** à faire signer, montant en lettres), **DTS** et **DAS**
  (cumuls annuels par salarié). DTS et DAS sont au **format générique** en attendant les modèles officiels.

## 2026-10-13 — Une seule entreprise à la fois

- À la connexion, chacun voit la ou les entreprises auxquelles il a accès et en choisit **une**.
  Il n'existe plus de vue « toutes mes entreprises » : tableau de bord, états, recherche, « À faire »
  et cloche portent uniquement sur l'entreprise de travail.
- Sans entreprise choisie, l'espace renvoie vers l'écran de choix (contrôle dans `proxy.ts`, puis dans
  chaque page). Une page d'une autre entreprise (lien d'une alerte) demande d'abord de basculer.
- Changement d'entreprise : menu du compte (initiales, en haut à droite). La page « À faire » indique
  seulement le nombre d'actions en attente dans les autres entreprises.
- L'écran de choix (`/choix-entreprise`) est **hors du cadre de l'espace** : ni menus, ni recherche, ni cloche ;
  seulement le logo et « Se déconnecter ». « Changer d'entreprise » quitte d'abord l'entreprise actuelle.

## 2026-10-13 — Création d'entreprise depuis la page de connexion uniquement

- On ne crée plus d'entreprise depuis l'espace connecté (page, menu et boutons retirés ; la page
  `/nouvelle-entreprise` redirige vers l'espace si l'on est déjà connecté).
- Page de connexion → **« Créer une nouvelle entreprise »** : le cabinet saisit son email et son mot de
  passe, puis la fiche de l'entreprise. Elle est rattachée à son cabinet (nom du cabinet demandé s'il en
  gère plusieurs) ; la base refuse si la personne n'administre pas ce cabinet. Un nouveau client sans
  compte passe par « Essayer gratuitement 30 jours ».

## 2026-10-13 — « Créer une nouvelle entreprise » : autonome ou confiée à un cabinet

- Le formulaire de la page de connexion est rempli par **l'entreprise, sans compte** : fiche (dont
  **N° CNAMGS employeur**, désormais sur toutes les fiches entreprise), personne à contacter, puis
  **qui fait la paie** (puces) :
  - **Autonome** : inscription habituelle (email d'activation, essai 30 jours) ; la fiche complète est reprise ;
  - **Paie gérée par un cabinet** : choix du cabinet inscrit et du nombre de salariés, bouton
    « Transmettre au cabinet <nom> ». La demande est enregistrée et les administrateurs du cabinet
    reçoivent un email ; l'entreprise reçoit un accusé de réception.
- Le cabinet traite la demande dans **Paramètres → Demandes d'entreprises** (aussi signalée par la cloche
  et « À faire ») : **accepter** (l'entreprise est créée chez lui en mode cabinet et le contact reçoit son
  accès d'administrateur de l'entreprise), **refuser** (email à l'entreprise) ou **demander des informations**
  (email à l'entreprise, qui répond directement à l'adresse du membre du cabinet).
- Un cabinet déjà inscrit garde son propre lien « Ajouter une entreprise cliente » (avec ses identifiants).
- Sécurité : chaque cabinet ne voit que ses demandes ; aucune écriture directe (dépôt par le serveur,
  traitement par des fonctions qui vérifient le cabinet) ; aucune fonction ouverte aux visiteurs.

## 2026-10-13 — Annulation du dépôt des bulletins

- Tant que la paie n'est pas envoyée en validation, la personne qui dépose peut **annuler le dépôt**
  (tous les bulletins du mois retirés d'un coup, après confirmation).
- Une fois envoyée, plus d'annulation : seul un validateur peut la **refuser**. Elle revient alors en
  brouillon chez la personne qui l'a préparée (bandeau avec le motif) : elle peut **modifier** (remplacer)
  ou **supprimer** des bulletins, ou annuler tout le dépôt, puis renvoyer en validation.
- Menu Paramètres : « Catalogue des modules » et « Demandes de démo » retirés.

## 2026-10-13 — Fiche salarié : mode de paiement, localisation, N° CNAMGS

- Nouveaux champs de la fiche salarié (formulaire et import Excel) : **mode de paiement** (virement,
  espèces, chèque, mobile money), **localisation** (lieu de travail) et **N° CNAMGS**.
- La création automatique des salariés absents à partir de leur bulletin, essayée le 13/10, a été
  **retirée le 14/10** à la demande de l'utilisateur : le dépôt en masse ne crée jamais de salarié.

## 2026-10-15 — Avis WhatsApp et émargement électronique des bulletins

- Option retenue : **message WhatsApp avec un lien** vers l'espace salarié (jamais le PDF), envoyé à la
  publication aux salariés qui ont un numéro et ont **donné leur accord** (fiche ou espace salarié).
  Suivi par bulletin : envoyé, reçu, lu, échec ; bouton de renvoi aux salariés pas encore prévenus.
- **Le téléchargement du bulletin par le salarié vaut émargement** (accusé de réception) : date et heure
  du premier téléchargement enregistrées (non modifiables), visibles par l'employeur, apposées sur
  l'« exemplaire émargé » (copie employeur générée à la demande, avec l'empreinte du bulletin d'origine).
- Le salarié en est informé dans son espace (« Télécharger votre bulletin vaut accusé de réception »).
- 2026-10-15 : **Twilio n'offre pas d'essai au Gabon** (constaté sur la console). Ajout de l'envoi par
  **Meta (WhatsApp Cloud API)**, prioritaire s'il est configuré (numéro de test gratuit pour les essais,
  pas d'intermédiaire en production). Twilio reste possible ; sans configuration, envoi simulé.
  Retours « reçu / lu / échec » de Meta acceptés seulement s'ils sont signés avec le secret de l'application.
