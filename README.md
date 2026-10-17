# DématPaie

Plateforme SaaS de paie zéro papier pour les cabinets comptables et les entreprises du Gabon.

**Phase 1** : espaces clients isolés, salariés et contrats, dépôt et publication des bulletins PDF,
circuit de validation, portail salarié, congés, réclamations, notifications, journal d'audit.
Le calcul de la paie viendra en phase 2.

---

## Lancer le projet sur votre ordinateur (Windows)

### 1. Outils à installer une seule fois

| Outil | Où le trouver | Vérifier dans PowerShell |
|---|---|---|
| Node.js 24 (LTS) | https://nodejs.org | `node -v` affiche `v24...` |
| Git | https://git-scm.com | `git --version` |
| VS Code (facultatif) | https://code.visualstudio.com | — |

### 2. Ouvrir PowerShell dans le dossier du projet

Dans l'Explorateur Windows, ouvrez le dossier `Bureau\PROJET\e-paie`, cliquez dans la barre
d'adresse, tapez `powershell` puis appuyez sur Entrée.

### 3. Installer les dépendances (la première fois, ou après une mise à jour)

```bash
npm install
```

Cela télécharge les bibliothèques du projet dans le dossier `node_modules` (quelques minutes).

### 4. Créer votre fichier de configuration

```bash
Copy-Item .env.example .env.local
```

Ouvrez ensuite `.env.local` avec le Bloc-notes et remplissez les valeurs
(les explications sont dans le fichier). **Ne partagez jamais ce fichier** : il contient vos clés.
Il est automatiquement exclu de Git.

**`DATABASE_URL`** : dans Supabase, bouton **Connect** → **Direct** → méthode **Session pooler**.
Copiez l'adresse (elle contient `pooler.supabase.com:5432`) et remplacez `[YOUR-PASSWORD]`,
**crochets compris**, par le mot de passe de la base.

> Astuce : désactivez la traduction automatique de Chrome sur supabase.com,
> elle provoque des erreurs dans le tableau de bord.

### 5. Créer ou mettre à jour les tables de la base

```bash
npm run db:migrer
```

Applique les fichiers de `supabase/migrations` qui ne l'ont pas encore été.
À relancer après chaque mise à jour du projet. Sans danger si la base est déjà à jour.

### 6. Configurer l'authentification et créer le premier administrateur (une seule fois)

Dans `.env.local`, renseignez aussi :
- `NEXT_PUBLIC_SUPABASE_URL` : `https://<Project ID>.supabase.co` (Project Settings → General)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : Project Settings → API Keys → « Publishable key »
- `SUPABASE_SECRET_KEY` : Project Settings → API Keys → « Secret key » (bouton « Reveal »).
  **Clé la plus sensible du projet** : elle contourne toutes les règles de sécurité. Elle n'est
  utilisée que côté serveur, pour créer les comptes, et ne doit jamais être partagée.

Dans Supabase :
1. **Authentication → Sign In / Providers** : désactivez « Allow new users to sign up »
   (les comptes sont créés uniquement par les administrateurs).
2. **Authentication → Users → Add user → Create new user** : email, mot de passe,
   cochez « Auto Confirm User ».

3. **Authentication → Email** (ou *Providers → Email*) : réglez « Email OTP Expiration » sur
   `86400` secondes (24 h), durée de validité des liens d'invitation et de réinitialisation.

**Emails (invitations, mot de passe oublié)** : créez un compte sur https://resend.com, ajoutez
votre domaine (onglet *Domains*) et les enregistrements DNS demandés chez votre hébergeur de
domaine, puis renseignez `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` dans `.env.local`.
Tant que ce n'est pas fait, en développement, les emails s'affichent dans la console du serveur.

Puis donnez-lui le rôle d'administrateur plateforme :

```bash
npm run admin:promouvoir -- votre@email.com
```

### 7. Démarrer l'application

```bash
npm run dev
```

Ouvrez votre navigateur à l'adresse **http://localhost:3000**.
Pour arrêter : revenez dans PowerShell et appuyez sur `Ctrl + C`.

### 8. Lancer les tests automatiques

```bash
npm test
```

Chaque test affiche une coche verte s'il réussit. Le résumé final doit indiquer `failed` à 0.

### 9. Lancer les tests de sécurité (isolation entre entreprises)

```bash
npm run test:securite
```

Ces tests essaient d'accéder aux données d'une autre entreprise et vérifient que la base refuse.
Ils travaillent sur la vraie base de développement mais **annulent tout à la fin** : aucune donnée
n'est laissée. Comptez 1 à 2 minutes selon la connexion.

---

## Inscription libre et abonnements

- Les prospects s'inscrivent sur `/inscription` (cabinet ou entreprise, essai ou Pro).
  Ils reçoivent un email d'activation ; leur espace et leur essai de 30 jours sont créés au clic.
- Page de connexion → **« Créer une nouvelle entreprise »** : l'entreprise choisit **Autonome** (compte créé,
  essai 30 jours) ou **Paie gérée par un cabinet** (demande transmise au cabinet choisi). Le cabinet
  l'accepte, la refuse ou demande des informations dans **Paramètres → Demandes d'entreprises**.
- Un cabinet déjà inscrit ajoute lui-même un client par le lien « Ajouter une entreprise cliente »
  (avec ses identifiants). La création n'est pas possible depuis l'espace connecté.
- Cycle : essai ou abonnement actif → **30 jours de lecture seule** → **blocage total**.
- L'administrateur plateforme gère les abonnements et le prix des formules dans
  **Abonnements** (menu de gauche) ; l'équipe reçoit un email à chaque inscription et à chaque
  demande Pro (adresse `EMAIL_ALERTES`).
- Les décisions métier sont consignées dans [`docs/decisions.md`](docs/decisions.md) et le plan dans [`docs/plan.md`](docs/plan.md).

## Portail salarié : connexion par SMS ou WhatsApp (Twilio)

Les salariés se connectent sur `/portail/connexion` avec le numéro saisi sur leur fiche.
Le code à 6 chiffres est envoyé par **Twilio Verify**, configuré **dans Supabase** :
aucune clé Twilio n'est à mettre dans `.env.local`.

1. Créez un compte sur [twilio.com](https://www.twilio.com) (l'essai gratuit suffit pour les tests).
2. Dans Twilio : **Verify → Services → Create new** (nom : `DématPaie`), cochez **SMS** et **WhatsApp**.
   Notez le **Service SID** (commence par `VA…`).
3. Dans Twilio, page d'accueil de la console : notez l'**Account SID** (`AC…`) et l'**Auth Token**.
4. Dans Supabase : **Authentication → Sign In / Providers → Phone** :
   activez-le, choisissez **Twilio Verify**, collez les trois valeurs, enregistrez.
5. Pour tester sans SMS réel : même page, **Test Phone Numbers and OTPs**, ajoutez par exemple
   `24177000001=123456` (numéro sans « + », puis le code). Donnez ce numéro (`+241 77 00 00 01`)
   à un salarié de test dans DématPaie.

Sécurité : un code n'est envoyé (et facturé) que pour un numéro enregistré par un employeur dont
l'abonnement est actif, au plus un code par minute et par numéro. Le message affiché est le même
que le numéro soit connu ou non. Le salarié ne voit que **ses** bulletins **publiés**.

## Alertes de paie (email et WhatsApp)

À chaque étape du circuit, les personnes qui doivent agir sont prévenues : validateurs de
l'étape en cours, publieurs une fois la période approuvée, gestionnaire après un refus.
Elles seules voient aussi un bandeau et une carte « À faire » dès qu'elles se connectent.

- **Email** : automatique (Resend, déjà configuré).
- **WhatsApp** : chaque personne saisit son numéro dans **Mon profil**. Côté plateforme :
  1. Dans Twilio : **Messaging → Try it out → Send a WhatsApp message** (bac à sable gratuit).
     Chaque testeur envoie le mot indiqué (ex. `join xxx-yyy`) au +1 415 523 8886 depuis son WhatsApp.
  2. Dans `.env.local` : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
     `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`, puis redémarrez l'application.
  3. En production : faites approuver un numéro WhatsApp Business et un modèle de message
     (Twilio → **Content Template Builder**, catégorie « Utility ») avec ce texte :
     `Bonjour {{1}}, une action vous attend sur DématPaie : {{2}}. Ouvrir : {{3}}`
     puis mettez son identifiant (`HX…`) dans `TWILIO_WHATSAPP_MODELE`.

Sans configuration Twilio, en développement, les messages WhatsApp s'affichent dans la console.

## Avis de bulletin par WhatsApp et émargement électronique

- À la **publication** de la paie, chaque salarié qui a un numéro et qui a **donné son accord** reçoit un
  WhatsApp (modèle `avis_bulletin`) : « Bonjour {{1}}, votre bulletin de paie de {{2}} ({{3}}) est disponible dans votre espace
  salarié : {{4}}. Le télécharger vaut accusé de réception. »
  Le bulletin ne passe jamais par WhatsApp : le lien ouvre l'espace salarié (connexion par code).
- **Accord** : sur la fiche du salarié (« Le salarié a donné son accord ») ou par le salarié dans son espace.
- **Émargement** : le téléchargement du bulletin par le salarié vaut accusé de réception. La page de la
  période indique « Émargé le … » pour chaque bulletin, et le lien « Exemplaire émargé » donne la copie
  employeur avec la mention d'émargement (le fichier d'origine n'est pas modifié). Le registre des
  bulletins (menu États) a une colonne « Émargé le ».
- **Envoi par Meta (recommandé, Twilio n'offrant pas d'essai au Gabon)** :
  1. developers.facebook.com → **Créer une application** (type « Entreprise ») → ajouter le produit **WhatsApp**.
  2. Page **Configuration de l'API** : Meta fournit un **numéro de test**. Copiez le **jeton d'accès** et
     l'**identifiant du numéro de téléphone** dans `META_WHATSAPP_JETON` et `META_WHATSAPP_NUMERO_ID`.
  3. Dans « À », **ajoutez votre numéro** (code de vérification reçu sur WhatsApp) : le numéro de test
     n'écrit qu'aux numéros ajoutés (5 au maximum).
  4. Essai sans modèle : envoyez d'abord un message WhatsApp au numéro de test (fenêtre de 24 h), puis
     publiez une paie d'essai. En production : créez le modèle `avis_bulletin` (catégorie « Utilité »,
     français, texte ci-dessus) dans WhatsApp Manager et mettez son nom dans `META_WHATSAPP_MODELE_BULLETIN`.
  5. Le jeton de la page de test dure 24 h : pour la production, créez un jeton permanent
     (Paramètres de l'entreprise → Utilisateurs système).
  6. Suivi « reçu / lu » : dans WhatsApp → Configuration, adresse de rappel `https://<votre site>/api/meta/whatsapp`,
     jeton de vérification = `META_WHATSAPP_JETON_VERIFICATION`, abonnement au champ « messages » ;
     `META_APP_SECRET` = clé secrète de l'application (Paramètres → Général).
- **Ou par Twilio** (`.env.local`) : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` et
  `TWILIO_WHATSAPP_MODELE_BULLETIN` (identifiant `HX…` du modèle ci-dessus, approuvé par WhatsApp,
  catégorie « Utility »). Twilio signale « reçu / lu / échec » à l'adresse `/api/twilio/statut` (appel signé).
  Sans configuration, en développement, les messages s'affichent dans la console.

## Application mobile des salariés

- L'espace salarié s'installe comme une application (« DématPaie Salarié ») depuis le navigateur du
  téléphone : bouton « Installer l'application » (Android) ou Partager → « Sur l'écran d'accueil » (iPhone).
- Fonctionne une fois DématPaie en ligne (adresse en https). Aucun bulletin n'est gardé sur le téléphone.

## Congés et absences

- Côté entreprise : ouvrez l'entreprise, puis le module **Congés & absences** (onglets
  Demandes, Planning, Soldes, Réglages). Commencez par **Réglages** : jours acquis par mois,
  jours fériés de l'année, types d'absence ; puis **Soldes** : solde de départ de chaque salarié.
- Congés prévisionnels : onglet **Planning**, carte « Congés prévisionnels » (gestionnaire de paie,
  RH, administrateurs). Le RH les confirme ensuite d'un clic.
- Côté salarié : onglet **Absences** de son espace (`/portail/absences`).

## Contrats : importer ou rédiger

- Fiche du salarié → onglet **Contrats** → « Nouveau contrat » : choisissez « Aucun » comme modèle pour
  **importer** le contrat signé, ou un modèle pour le **rédiger** dans DématPaie (l'éditeur s'ouvre).
- **Modèles de contrat** : lien « Gérer les modèles » (adresse `/espace/entreprises/<id>/modeles-contrat`).
  Personnalisez un modèle standard ou importez votre modèle Word, et utilisez « + Insérer un champ ».
- Le PDF est généré par le serveur (police Roboto incluse, aucun accès Internet).

## Réclamations

- Salarié : onglet **Réclamations** de son espace (`/portail/reclamations`).
- Entreprise : module **Self-service** de l'entreprise (`/espace/entreprises/<id>/reclamations`) ; les
  réclamations à traiter apparaissent aussi dans « À faire ». Bulletin → gestionnaire de paie ; autres
  sujets → RH ; à défaut, administrateurs.

## Résultats de paie et états de paie

- Chaque mois : **Paie → Périodes et bulletins** → ouvrez la période → carte **« Résultats de paie (Excel) »**.
  Choisissez l'Excel exporté du logiciel de paie (.xlsx, une ligne par salarié avec une colonne « Matricule »),
  vérifiez la correspondance des colonnes, puis cliquez sur « Importer ».
- Les états se trouvent dans le menu **États** : livre de paie, soldes de tout compte (avec le reçu à imprimer),
  DTS et DAS (choisissez l'année ; par défaut l'année écoulée).

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'application en mode développement |
| `npm test` | Lance tous les tests une fois |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run test:securite` | Lance les tests d'isolation sur la base |
| `npm run db:migrer` | Crée ou met à jour les tables de la base |
| `npm run admin:promouvoir -- email` | Donne le rôle d'administrateur plateforme à un compte |
| `npm run verifier:secrets` | Après `npm run build` : vérifie qu'aucun secret n'est envoyé au navigateur |
| `npm run lint` | Vérifie la qualité du code |
| `npm run build` | Prépare la version de production |

## Équipe d'agents IA (Claude Code)

Trois agents spécialisés sont affectés au projet, dans `.claude/agents/` :

| Agent | Rôle | Quand l'appeler |
|---|---|---|
| `manager-saas` | Chef de projet et architecte SaaS | Cadrer une étape du plan, découper en tâches, relire avant commit, répartir le travail |
| `securite-saas` | Expert cybersécurité, tests de failles | Audit d'un module, test d'isolation entre clients, revue de tout changement sensible (connexion, rôles, paiement, fichiers) |
| `designer-saas` | Web design et UX des SaaS | Nouvelle page, revue d'une interface, portail salarié sur téléphone, cohérence avec la charte |

Dans Claude Code, ouvert dans ce dossier, demandez simplement par exemple :
« Utilise l'agent securite-saas pour auditer le portail salarié » ou
« Demande à manager-saas de préparer l'étape 12 du plan ».
L'expert sécurité ne teste qu'en local, sur la base de développement, jamais sur le site en ligne.

## Organisation des dossiers

```
e-paie/
├── src/app/              ← les pages de l'application
├── supabase/migrations/  ← création des tables et règles de sécurité (dans l'ordre)
├── scripts/              ← outils (application des migrations)
├── tests/unit/           ← tests automatiques de l'interface
├── tests/securite/       ← tests d'isolation entre entreprises
├── public/               ← images et fichiers statiques
├── .env.example      ← modèle de configuration (sans secrets)
└── README.md         ← ce fichier
```

## Problèmes fréquents

- **`npm` n'est pas reconnu** : fermez et rouvrez PowerShell après l'installation de Node.js.
- **Le port 3000 est déjà utilisé** : une autre fenêtre fait déjà tourner l'application ;
  fermez-la ou utilisez l'adresse indiquée par `npm run dev`.
- **`password authentication failed`** : le mot de passe dans `DATABASE_URL` est faux, ou
  les crochets `[ ]` autour sont restés. S'il contient `@ # / ? % :`, réinitialisez-le dans
  Supabase avec uniquement des lettres et des chiffres.

## Mise en ligne (Vercel)

- Hébergeur : **Vercel** (formule gratuite pour la phase d'essai ; formule Pro obligatoire avant un usage
  commercial). Région des fonctions : Paris (`cdg1`, dans `vercel.json`), à côté de la base Supabase.
- Chaque enregistrement sur la branche `main` de GitHub est mis en ligne automatiquement.
- Réglages à recopier dans Vercel (Settings → Environment Variables), jamais dans le code :
  `NEXT_PUBLIC_SITE_URL` (adresse en ligne), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_EXPEDITEUR`, `EMAIL_ALERTES`, `GENUKA_*`, `META_WHATSAPP_*`,
  `META_APP_SECRET`. `DATABASE_URL` n'est **pas** nécessaire en ligne (outils et tests du poste uniquement).
- Envois de fichiers limités à 4 Mo (Vercel refuse plus de 4,5 Mo par envoi) ; bulletins : 2 Mo.
