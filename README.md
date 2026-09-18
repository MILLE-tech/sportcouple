# SportCouple

Application web de suivi sportif et nutritionnel pour un couple. Conçue
pour tourner **entièrement gratuitement**, sans carte bancaire :

- **Hébergement** : [Vercel](https://vercel.com) (plan Hobby gratuit)
- **Base de données, auth, stockage** : [Supabase](https://supabase.com) (plan Free)
- **Polices** : Google Fonts self-hébergées via `next/font`
- **Graphiques** : [Recharts](https://recharts.org) (open source)

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Supabase (Auth email/mot de passe, Postgres, Row Level Security)
- Recharts

## État actuel

✅ Schéma de base de données complet (`supabase/schema.sql`)
✅ Authentification (inscription, connexion, déconnexion)
✅ Création / adhésion à un couple via code d'invitation à 6 caractères
✅ Coquille d'application protégée (navigation basse mobile / sidebar desktop)
⏳ Les 5 onglets (Repas, Mensurations, Poids, Sport, Progression) seront
   implémentés un par un dans les prochaines étapes.

## 1. Créer le projet Supabase (gratuit)

1. Crée un compte sur [supabase.com](https://supabase.com) (aucune carte
   bancaire requise pour le plan Free).
2. Crée un nouveau projet.
3. Dans **SQL Editor**, colle l'intégralité du contenu de
   [`supabase/schema.sql`](./supabase/schema.sql) et exécute-le. Cela crée
   toutes les tables, contraintes, policies RLS et le programme de sport
   préconstruit.
4. Dans **Authentication > Providers**, vérifie que le provider **Email**
   est activé. Par défaut, Supabase exige une confirmation par email :
   - En développement, tu peux désactiver "Confirm email" dans
     **Authentication > Providers > Email** pour tester plus vite.
   - En production, laisse la confirmation active et configure l'URL de
     redirection (étape suivante).
5. Dans **Authentication > URL Configuration**, ajoute l'URL de ton site
   (ex. `https://ton-app.vercel.app`) dans **Site URL** et
   `https://ton-app.vercel.app/auth/callback` dans **Redirect URLs**
   (ajoute aussi `http://localhost:3000/auth/callback` pour le
   développement local).
6. Récupère l'URL du projet et la clé `anon public` dans
   **Project Settings > API**.

## 2. Configuration locale

```bash
cp .env.example .env.local
```

Renseigne `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
dans `.env.local` avec les valeurs récupérées à l'étape précédente.

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## 3. Déploiement gratuit sur Vercel

1. Pousse le projet sur GitHub.
2. Sur [vercel.com](https://vercel.com), clique sur **Add New > Project**
   et importe le dépôt (plan Hobby, gratuit).
3. Ajoute les variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans **Settings > Environment
   Variables**.
4. Déploie. Vercel détecte automatiquement Next.js.
5. Reviens dans Supabase (**Authentication > URL Configuration**) pour
   ajouter l'URL Vercel définitive si ce n'est pas déjà fait à l'étape 1.5.

## Structure du projet

```
supabase/schema.sql       # Schéma complet : tables, index, RLS, seed exercices
src/lib/supabase/         # Clients Supabase (browser / server / middleware)
src/lib/types/database.ts # Types TypeScript miroir du schéma SQL
src/middleware.ts         # Rafraîchissement de session + protection des routes
src/app/login, /signup    # Authentification
src/app/couple-setup      # Création / adhésion à un couple
src/app/(app)/            # Coquille protégée + les 5 onglets
```

## Modèle de données (résumé)

- `profiles` : un profil par utilisateur, créé automatiquement à
  l'inscription (trigger `handle_new_user`) à partir des métadonnées
  passées à `supabase.auth.signUp`.
- `couples` : un couple = 2 profils partageant le même `couple_id`. Créé
  via la fonction RPC `create_couple()`, rejoint via `join_couple(code)`.
- RLS : chaque utilisateur écrit uniquement ses propres lignes, mais peut
  lire celles de son/sa partenaire (même `couple_id`), via la fonction
  `can_view_user_data()`.
- `favorite_foods`, `meal_entries` : repas et aliments favoris.
- `measurement_types`, `body_measurements` : mensurations, avec un sens
  de variation (`lower_is_better`) configurable par mesure.
- `weight_entries` : une entrée par semaine ISO et par utilisateur
  (colonnes générées `iso_year` / `iso_week`).
- `workout_session_types`, `exercises`, `workout_logs` : programme de
  sport préconstruit (3 séances × 2 variantes sans/avec haltères) et
  historique des séances terminées.

## Coût

Tant que l'usage reste dans les limites des plans gratuits Vercel Hobby
et Supabase Free (largement suffisantes pour un usage à deux personnes),
cette application ne coûte rien.
