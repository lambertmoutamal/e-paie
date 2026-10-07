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

### 5. Démarrer l'application

```bash
npm run dev
```

Ouvrez votre navigateur à l'adresse **http://localhost:3000**.
Pour arrêter : revenez dans PowerShell et appuyez sur `Ctrl + C`.

### 6. Lancer les tests automatiques

```bash
npm test
```

Chaque test affiche une coche verte s'il réussit. Le résumé final doit indiquer `failed` à 0.

---

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'application en mode développement |
| `npm test` | Lance tous les tests une fois |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run lint` | Vérifie la qualité du code |
| `npm run build` | Prépare la version de production |

## Organisation des dossiers

```
e-paie/
├── src/app/          ← les pages de l'application
├── tests/unit/       ← les tests automatiques
├── public/           ← images et fichiers statiques
├── .env.example      ← modèle de configuration (sans secrets)
└── README.md         ← ce fichier
```

## Problèmes fréquents

- **`npm` n'est pas reconnu** : fermez et rouvrez PowerShell après l'installation de Node.js.
- **Le port 3000 est déjà utilisé** : une autre fenêtre fait déjà tourner l'application ;
  fermez-la ou utilisez l'adresse indiquée par `npm run dev`.
