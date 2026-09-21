-- ============================================================================
-- Migration 0004 — Rôle admin (lecture seule sur toutes les données)
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase, EN PLUS des migrations
-- précédentes (0002, 0003).
--
-- Étapes après avoir lancé ce script :
--   1. Crée un compte normalement via la page /signup de l'appli (n'importe
--      quel email + mot de passe de ton choix).
--   2. Repasse dans le SQL Editor et lance (en remplaçant l'email) :
--
--        update public.profiles
--        set is_admin = true
--        where id = (select id from auth.users where email = 'TON_EMAIL_ICI');
--
--   3. Reconnecte-toi : ce compte atterrit directement sur /admin.
-- ============================================================================

alter table public.profiles
  add column is_admin boolean not null default false;

-- ----------------------------------------------------------------------------
-- Verrou : is_admin ne peut jamais être changé par une requête ordinaire
-- (authenticated), même si quelqu'un l'inclut dans un appel à l'API standard.
-- Seul le rôle service_role (jamais exposé au navigateur) ou une requête
-- lancée directement dans le SQL Editor Supabase peuvent le modifier.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_self_admin_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if auth.role() <> 'service_role' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_admin_promotion on public.profiles;
create trigger prevent_self_admin_promotion
  before update on public.profiles
  for each row execute function public.prevent_self_admin_promotion();

-- ----------------------------------------------------------------------------
-- Fonction utilitaire RLS : l'utilisateur courant est-il admin ?
-- ----------------------------------------------------------------------------

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- Extension des policies SELECT existantes : un admin peut tout lire,
-- mais ne gagne AUCUN droit d'écriture supplémentaire (insert/update/delete
-- restent inchangés, limités aux propres données de chacun).
-- ----------------------------------------------------------------------------

drop policy if exists "profiles_select_own_or_partner" on public.profiles;
create policy "profiles_select_own_or_partner" on public.profiles
  for select
  using (public.can_view_user_data(id) or public.is_admin_user());

drop policy if exists "couples_select" on public.couples;
create policy "couples_select" on public.couples
  for select
  using (created_by = auth.uid() or id = public.my_couple_id() or public.is_admin_user());

drop policy if exists "favorite_foods_select" on public.favorite_foods;
create policy "favorite_foods_select" on public.favorite_foods
  for select using (public.can_view_user_data(user_id) or public.is_admin_user());

drop policy if exists "meal_entries_select" on public.meal_entries;
create policy "meal_entries_select" on public.meal_entries
  for select using (public.can_view_user_data(user_id) or public.is_admin_user());

drop policy if exists "body_measurements_select" on public.body_measurements;
create policy "body_measurements_select" on public.body_measurements
  for select using (public.can_view_user_data(user_id) or public.is_admin_user());

drop policy if exists "weight_entries_select" on public.weight_entries;
create policy "weight_entries_select" on public.weight_entries
  for select using (public.can_view_user_data(user_id) or public.is_admin_user());

drop policy if exists "workout_logs_select" on public.workout_logs;
create policy "workout_logs_select" on public.workout_logs
  for select using (public.can_view_user_data(user_id) or public.is_admin_user());

drop policy if exists "daily_steps_select" on public.daily_steps;
create policy "daily_steps_select" on public.daily_steps
  for select using (public.can_view_user_data(user_id) or public.is_admin_user());

-- ============================================================================
-- Fin de la migration 0004
-- ============================================================================
