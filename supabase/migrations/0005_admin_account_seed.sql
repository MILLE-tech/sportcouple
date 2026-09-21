-- ============================================================================
-- Migration 0005 — Création directe du compte admin (sans passer par /signup)
-- ============================================================================
-- Avant de lancer ce script : remplace REMPLACE_PAR_TON_MOT_DE_PASSE
-- ci-dessous par un mot de passe de ton choix (au moins 12 caractères,
-- n'importe lesquels). Ne le partage avec personne d'autre que Vercel.
--
-- Ce script :
--   1. Crée directement un compte dans auth.users (email technique fixe,
--      jamais affiché ni demandé dans l'appli).
--   2. Le trigger existant (handle_new_user) crée automatiquement le
--      profil associé.
--   3. Marque ce profil is_admin = true.
--
-- Prérequis : migration 0004 déjà exécutée (colonne is_admin, policies).
--
-- Après avoir lancé ce script, va sur Vercel > ton projet > Settings >
-- Environment Variables et ajoute :
--   ADMIN_SHORTCUT_PASSWORD = (le même mot de passe que tu as mis ci-dessous)
-- Puis redéploie une fois. Ensuite, tape "admin" / "admin" sur /login.
-- ============================================================================

with new_admin as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@sportcouple.internal',
    crypt('REMPLACE_PAR_TON_MOT_DE_PASSE', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Admin","sex":"homme","birth_date":"2000-01-01","height_cm":170}'::jsonb,
    '', '', '', '', ''
  )
  returning id
)
update public.profiles
set is_admin = true
where id = (select id from new_admin);

-- ============================================================================
-- Fin de la migration 0005
--
-- Si cette migration échoue (schéma auth.users légèrement différent selon
-- la version de Supabase), solution de repli fiable à 100% : crée le
-- compte normalement via /signup avec n'importe quel email, puis lance :
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'TON_EMAIL');
-- (et mets ce même email dans ADMIN_SHORTCUT_EMAIL sur Vercel en plus de
-- ADMIN_SHORTCUT_PASSWORD)
-- ============================================================================
