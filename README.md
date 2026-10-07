# e-Paie

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
