-- ============================================================================
-- SportCouple — schéma Supabase (Postgres)
-- ============================================================================
-- À exécuter une fois dans l'éditeur SQL de votre projet Supabase (gratuit).
-- Ce fichier est destiné à une exécution initiale sur une base vide (pas de
-- gestion de migrations ici).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. COUPLES & PROFILS
-- ============================================================================

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.couples is 'Un couple = 2 profils partageant leurs données en lecture.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  sex text not null check (sex in ('homme', 'femme')),
  birth_date date not null,
  height_cm numeric(5, 1) not null check (height_cm > 0 and height_cm < 300),
  couple_id uuid references public.couples (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_couple_id_idx on public.profiles (couple_id);

comment on table public.profiles is 'Un profil par utilisateur (auth.uid()).';

-- ----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription, à partir des métadonnées
-- passées dans supabase.auth.signUp({ options: { data: { ... } } }).
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, sex, birth_date, height_cm)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', 'Utilisateur'),
    coalesce(new.raw_user_meta_data ->> 'sex', 'homme'),
    coalesce((new.raw_user_meta_data ->> 'birth_date')::date, '2000-01-01'),
    coalesce((new.raw_user_meta_data ->> 'height_cm')::numeric, 170)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Fonctions utilitaires RLS (security definer : contournent le RLS en interne
-- pour éviter toute récursion sur la table profiles).
-- ----------------------------------------------------------------------------

create or replace function public.my_couple_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select couple_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_view_user_data(target_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target_user = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = target_user
        and p.couple_id is not null
        and p.couple_id = public.my_couple_id()
    );
$$;

-- ----------------------------------------------------------------------------
-- Génération de code d'invitation + création / adhésion à un couple.
-- Exposées en RPC (supabase.rpc(...)) pour rester atomiques et contourner le
-- RLS (un utilisateur ne peut pas lire un couple avant de l'avoir rejoint).
-- ----------------------------------------------------------------------------

create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sans O/0 ni I/1
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.couples where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_couple()
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'already_in_couple';
  end if;

  insert into public.couples (invite_code, created_by)
  values (public.generate_invite_code(), auth.uid())
  returning * into v_couple;

  update public.profiles
  set couple_id = v_couple.id, updated_at = now()
  where id = auth.uid();

  return v_couple;
end;
$$;

create or replace function public.join_couple(p_invite_code text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples;
  v_member_count int;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'already_in_couple';
  end if;

  select * into v_couple from public.couples where invite_code = upper(trim(p_invite_code));
  if v_couple.id is null then
    raise exception 'invalid_code';
  end if;

  select count(*) into v_member_count from public.profiles where couple_id = v_couple.id;
  if v_member_count >= 2 then
    raise exception 'couple_full';
  end if;

  update public.profiles
  set couple_id = v_couple.id, updated_at = now()
  where id = auth.uid();

  return v_couple;
end;
$$;

grant execute on function public.create_couple() to authenticated;
grant execute on function public.join_couple(text) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS : couples
-- ----------------------------------------------------------------------------

alter table public.couples enable row level security;

create policy "couples_select" on public.couples
  for select
  using (created_by = auth.uid() or id = public.my_couple_id());

-- Les insert/update passent exclusivement par les fonctions security definer
-- ci-dessus ; aucune policy insert/update n'est nécessaire côté client.

-- ----------------------------------------------------------------------------
-- RLS : profiles
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_partner" on public.profiles
  for select
  using (public.can_view_user_data(id));

create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================================
-- 2. REPAS
-- ============================================================================

create type public.meal_type as enum ('petit_dejeuner', 'dejeuner', 'diner', 'collation');

create table public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  default_quantity text,
  default_calories numeric(6, 1),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index favorite_foods_user_idx on public.favorite_foods (user_id);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  meal_type public.meal_type not null,
  name text not null,
  quantity text,
  calories numeric(6, 1),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index meal_entries_user_date_idx on public.meal_entries (user_id, entry_date);

alter table public.favorite_foods enable row level security;

create policy "favorite_foods_select" on public.favorite_foods
  for select using (public.can_view_user_data(user_id));
create policy "favorite_foods_insert" on public.favorite_foods
  for insert with check (user_id = auth.uid());
create policy "favorite_foods_update" on public.favorite_foods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "favorite_foods_delete" on public.favorite_foods
  for delete using (user_id = auth.uid());

alter table public.meal_entries enable row level security;

create policy "meal_entries_select" on public.meal_entries
  for select using (public.can_view_user_data(user_id));
create policy "meal_entries_insert" on public.meal_entries
  for insert with check (user_id = auth.uid());
create policy "meal_entries_update" on public.meal_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meal_entries_delete" on public.meal_entries
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Aliments courants : suggestions partagées (lecture seule), pour que
-- l'autocomplétion ne soit pas vide avant que l'utilisateur ait ses favoris.
-- ----------------------------------------------------------------------------

create table public.common_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_quantity text,
  default_calories numeric(6, 1),
  sort_order int not null default 0
);

alter table public.common_foods enable row level security;

create policy "common_foods_select" on public.common_foods
  for select using (true);

insert into public.common_foods (name, default_quantity, default_calories, sort_order) values
  ('Riz cuit', '150 g', 195, 10),
  ('Pâtes cuites', '150 g', 220, 20),
  ('Pain (baguette)', '50 g', 135, 30),
  ('Pomme de terre', '150 g', 130, 40),
  ('Flocons d''avoine', '50 g', 190, 50),
  ('Quinoa cuit', '150 g', 175, 60),
  ('Lentilles cuites', '150 g', 170, 70),
  ('Poulet (blanc)', '100 g', 165, 80),
  ('Steak haché 5%', '100 g', 130, 90),
  ('Saumon', '100 g', 210, 100),
  ('Thon (boîte au naturel)', '100 g', 105, 110),
  ('Jambon blanc', '2 tranches', 50, 120),
  ('Œuf', '1 pièce', 70, 130),
  ('Yaourt nature', '125 g', 60, 140),
  ('Fromage blanc', '100 g', 75, 150),
  ('Lait demi-écrémé', '200 ml', 90, 160),
  ('Fromage (portion)', '30 g', 100, 170),
  ('Pomme', '1 pièce', 80, 180),
  ('Banane', '1 pièce', 105, 190),
  ('Avocat', '1/2 pièce', 120, 200),
  ('Tomate', '1 pièce', 20, 210),
  ('Salade verte', '50 g', 10, 220),
  ('Brocoli', '100 g', 35, 230),
  ('Amandes', '30 g', 175, 240),
  ('Beurre', '10 g', 75, 250),
  ('Huile d''olive', '1 c. à soupe', 90, 260),
  ('Chocolat noir', '20 g', 110, 270),
  ('Café (noir)', '1 tasse', 2, 280);

-- ============================================================================
-- 3. MENSURATIONS
-- ============================================================================

create table public.measurement_types (
  code text primary key,
  label_fr text not null,
  applies_to text not null check (applies_to in ('homme', 'femme', 'tous')),
  lower_is_better boolean not null default true,
  sort_order int not null default 0
);

comment on column public.measurement_types.lower_is_better is
  'Sens de la variation "positive" pour cette mesure : true = une baisse est affichée en vert, false = une hausse est affichée en vert.';

insert into public.measurement_types (code, label_fr, applies_to, lower_is_better, sort_order) values
  ('poitrine', 'Poitrine', 'femme', true, 10),
  ('pectoraux', 'Pectoraux', 'homme', false, 10),
  ('taille', 'Tour de taille', 'tous', true, 20),
  ('hanches', 'Tour de hanches', 'femme', true, 30),
  ('cuisses', 'Tour de cuisses', 'tous', true, 40),
  ('mollets', 'Tour de mollets', 'tous', true, 50),
  ('bras', 'Bras', 'tous', false, 60);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  measurement_type text not null references public.measurement_types (code),
  measured_on date not null,
  value_cm numeric(5, 1) not null check (value_cm > 0),
  created_at timestamptz not null default now(),
  unique (user_id, measurement_type, measured_on)
);

create index body_measurements_user_type_idx on public.body_measurements (user_id, measurement_type, measured_on);

alter table public.measurement_types enable row level security;

create policy "measurement_types_select" on public.measurement_types
  for select using (true);

alter table public.body_measurements enable row level security;

create policy "body_measurements_select" on public.body_measurements
  for select using (public.can_view_user_data(user_id));
create policy "body_measurements_insert" on public.body_measurements
  for insert with check (user_id = auth.uid());
create policy "body_measurements_update" on public.body_measurements
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "body_measurements_delete" on public.body_measurements
  for delete using (user_id = auth.uid());

-- ============================================================================
-- 4. POIDS
-- ============================================================================

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 1) not null check (weight_kg > 0 and weight_kg < 500),
  iso_year int generated always as (extract(isoyear from measured_on)::int) stored,
  iso_week int generated always as (extract(week from measured_on)::int) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, iso_year, iso_week)
);

create index weight_entries_user_date_idx on public.weight_entries (user_id, measured_on);

alter table public.weight_entries enable row level security;

create policy "weight_entries_select" on public.weight_entries
  for select using (public.can_view_user_data(user_id));
create policy "weight_entries_insert" on public.weight_entries
  for insert with check (user_id = auth.uid());
create policy "weight_entries_update" on public.weight_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weight_entries_delete" on public.weight_entries
  for delete using (user_id = auth.uid());

-- ============================================================================
-- 5. SPORT
-- ============================================================================

create table public.workout_session_types (
  code text primary key,
  name text not null,
  focus text not null,
  sort_order int not null
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.workout_session_types (code) on delete cascade,
  exercise_group text not null,
  variant text not null check (variant in ('sans_halteres', 'avec_halteres')),
  name text not null,
  target_muscles text not null,
  sets int not null check (sets > 0),
  reps text,
  duration_seconds int,
  rest_seconds int not null check (rest_seconds >= 0),
  description text not null,
  sort_order int not null,
  unique (session_code, exercise_group, variant)
);

create index exercises_session_idx on public.exercises (session_code, sort_order);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_code text not null references public.workout_session_types (code),
  variant text not null check (variant in ('sans_halteres', 'avec_halteres')),
  performed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index workout_logs_user_date_idx on public.workout_logs (user_id, performed_on);

alter table public.workout_session_types enable row level security;

create policy "workout_session_types_select" on public.workout_session_types
  for select using (true);

alter table public.exercises enable row level security;

create policy "exercises_select" on public.exercises
  for select using (true);

alter table public.workout_logs enable row level security;

create policy "workout_logs_select" on public.workout_logs
  for select using (public.can_view_user_data(user_id));
create policy "workout_logs_insert" on public.workout_logs
  for insert with check (user_id = auth.uid());
create policy "workout_logs_delete" on public.workout_logs
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Seed : 3 séances préconstruites, à faire à la maison.
-- ----------------------------------------------------------------------------

insert into public.workout_session_types (code, name, focus, sort_order) values
  ('A', 'Séance A', 'Bas du corps (jambes, fessiers) + cardio', 10),
  ('B', 'Séance B', 'Haut du corps (bras, épaules, dos, pectoraux)', 20),
  ('C', 'Séance C', 'Ventre / gainage + cardio (HIIT)', 30);

-- Séance A — Bas du corps + cardio
insert into public.exercises
  (session_code, exercise_group, variant, name, target_muscles, sets, reps, duration_seconds, rest_seconds, description, sort_order)
values
  ('A', 'squat', 'sans_halteres', 'Squat au poids du corps', 'Fessiers, quadriceps, ischio-jambiers', 3, '15-20', null, 45,
    'Pieds largeur d''épaules, descends en poussant les hanches vers l''arrière, genoux alignés avec les orteils, remonte en poussant sur les talons.', 10),
  ('A', 'squat', 'avec_halteres', 'Goblet squat avec haltère', 'Fessiers, quadriceps, ischio-jambiers', 3, '12-15', null, 60,
    'Tiens un haltère à deux mains contre la poitrine, descends en squat en gardant le buste droit, remonte en poussant sur les talons.', 10),

  ('A', 'fente', 'sans_halteres', 'Fentes avant alternées', 'Fessiers, quadriceps', 3, '12 par jambe', null, 45,
    'Fais un grand pas en avant, descends jusqu''à ce que les deux genoux forment un angle de 90°, reviens et alterne les jambes.', 20),
  ('A', 'fente', 'avec_halteres', 'Fentes avant avec haltères', 'Fessiers, quadriceps', 3, '10 par jambe', null, 60,
    'Un haltère dans chaque main le long du corps, réalise des fentes avant en gardant le buste droit et le genou arrière proche du sol.', 20),

  ('A', 'pont_fessier', 'sans_halteres', 'Pont fessier au sol', 'Fessiers, ischio-jambiers', 3, '20', null, 45,
    'Allongé sur le dos, genoux pliés, pieds au sol, pousse les hanches vers le haut en contractant les fessiers, redescends sans reposer complètement.', 30),
  ('A', 'pont_fessier', 'avec_halteres', 'Pont fessier lesté', 'Fessiers, ischio-jambiers', 3, '15', null, 60,
    'Même mouvement que le pont fessier au sol, en plaçant un haltère sur le bassin pour ajouter de la résistance.', 30),

  ('A', 'squat_sumo', 'sans_halteres', 'Squat sumo', 'Fessiers, adducteurs, quadriceps', 3, '15', null, 45,
    'Pieds bien plus larges que les épaules, pointes légèrement tournées vers l''extérieur, descends en squat profond en gardant le dos droit.', 40),
  ('A', 'squat_sumo', 'avec_halteres', 'Squat sumo avec haltère', 'Fessiers, adducteurs, quadriceps', 3, '12', null, 60,
    'Même mouvement que le squat sumo, en tenant un haltère à deux mains devant toi pour ajouter de la charge.', 40),

  ('A', 'mollets', 'sans_halteres', 'Montées sur pointes de pieds', 'Mollets', 3, '25', null, 30,
    'Debout, monte lentement sur la pointe des pieds puis redescends sans à-coup, en gardant les jambes tendues.', 50),
  ('A', 'mollets', 'avec_halteres', 'Montées sur pointes avec haltères', 'Mollets', 3, '20', null, 30,
    'Un haltère dans chaque main le long du corps, réalise des montées sur pointes de pieds de façon contrôlée.', 50),

  ('A', 'cardio_squat_saute', 'sans_halteres', 'Squat sauté (jump squat)', 'Cardio, jambes, fessiers', 3, null, 40, 30,
    'Enchaîne des squats explosifs avec un saut en position haute, atterris en douceur en repliant les genoux.', 60),
  ('A', 'cardio_squat_saute', 'avec_halteres', 'Squat + rowing avec haltères', 'Cardio, jambes, dos', 3, null, 40, 30,
    'Descends en squat en tenant un haltère dans chaque main, puis à la remontée, tire les haltères vers les côtes (rowing) pour un circuit cardio complet.', 60);

-- Séance B — Haut du corps
insert into public.exercises
  (session_code, exercise_group, variant, name, target_muscles, sets, reps, duration_seconds, rest_seconds, description, sort_order)
values
  ('B', 'pompes', 'sans_halteres', 'Pompes', 'Pectoraux, triceps, épaules', 3, '8-15', null, 60,
    'Mains légèrement plus larges que les épaules, corps gainé en ligne droite, descends la poitrine vers le sol puis repousse.', 10),
  ('B', 'pompes', 'avec_halteres', 'Développé couché au sol avec haltères', 'Pectoraux, triceps, épaules', 3, '12', null, 60,
    'Allongé au sol, un haltère dans chaque main au-dessus de la poitrine, descends les coudes vers le sol puis repousse les haltères vers le haut.', 10),

  ('B', 'dos_superman', 'sans_halteres', 'Superman (extension dorsale)', 'Dos, fessiers', 3, '15', null, 45,
    'Allongé sur le ventre, lève simultanément bras et jambes tendus, maintiens 1-2 secondes puis redescends.', 20),
  ('B', 'dos_superman', 'avec_halteres', 'Rowing haltère buste penché', 'Dos, biceps', 3, '12', null, 60,
    'Buste penché en avant, dos droit, tire les haltères vers les hanches en serrant les omoplates, puis redescends contrôlé.', 20),

  ('B', 'epaules', 'sans_halteres', 'Pike push-up (pompes piquées)', 'Épaules, triceps', 3, '8-12', null, 60,
    'En position de V inversé, fléchis les coudes pour amener la tête vers le sol entre les mains, puis repousse.', 30),
  ('B', 'epaules', 'avec_halteres', 'Développé militaire avec haltères', 'Épaules, triceps', 3, '12', null, 60,
    'Debout, un haltère dans chaque main au niveau des épaules, pousse les haltères au-dessus de la tête puis redescends.', 30),

  ('B', 'biceps', 'sans_halteres', 'Curl isométrique (contraction biceps)', 'Biceps', 3, null, 30, 30,
    'Contracte volontairement les biceps en fléchissant les bras devant toi, maintiens la tension sans charge.', 40),
  ('B', 'biceps', 'avec_halteres', 'Curl biceps avec haltères', 'Biceps', 3, '15', null, 45,
    'Debout, un haltère dans chaque main, fléchis les coudes pour remonter les haltères vers les épaules puis redescends lentement.', 40),

  ('B', 'triceps', 'sans_halteres', 'Dips sur chaise', 'Triceps, épaules', 3, '12', null, 45,
    'Mains posées sur le bord d''une chaise, jambes tendues devant, fléchis les coudes pour descendre le bassin puis repousse.', 50),
  ('B', 'triceps', 'avec_halteres', 'Extension triceps haltère au-dessus de la tête', 'Triceps', 3, '12', null, 45,
    'Debout, tiens un haltère à deux mains au-dessus de la tête, fléchis les coudes pour descendre l''haltère derrière la nuque puis retends les bras.', 50),

  ('B', 'pectoraux_ecart', 'sans_halteres', 'Écartés au sol (pompes larges)', 'Pectoraux, épaules', 3, '12', null, 45,
    'Pompes avec les mains bien plus écartées que les épaules pour cibler davantage les pectoraux.', 60),
  ('B', 'pectoraux_ecart', 'avec_halteres', 'Écartés couché avec haltères', 'Pectoraux, épaules', 3, '12', null, 60,
    'Allongé au sol, bras tendus au-dessus de la poitrine avec un haltère dans chaque main, ouvre les bras sur les côtés puis remonte.', 60);

-- Séance C — Ventre / gainage + cardio (HIIT)
insert into public.exercises
  (session_code, exercise_group, variant, name, target_muscles, sets, reps, duration_seconds, rest_seconds, description, sort_order)
values
  ('C', 'planche', 'sans_halteres', 'Planche (gainage)', 'Sangle abdominale, gainage', 3, null, 40, 30,
    'Appui sur les avant-bras et les pointes de pieds, corps aligné de la tête aux talons, contracte les abdominaux.', 10),
  ('C', 'planche', 'avec_halteres', 'Planche lestée', 'Sangle abdominale, gainage', 3, null, 30, 30,
    'Même position que la planche classique, avec un haltère posé sur le bas du dos pour ajouter de la difficulté.', 10),

  ('C', 'crunch', 'sans_halteres', 'Crunchs', 'Abdominaux', 3, '20', null, 30,
    'Allongé sur le dos, genoux pliés, mains derrière la tête, décolle les épaules du sol en contractant les abdos.', 20),
  ('C', 'crunch', 'avec_halteres', 'Crunchs avec haltère', 'Abdominaux', 3, '15', null, 30,
    'Même mouvement que le crunch classique, en tenant un haltère contre la poitrine pour ajouter de la résistance.', 20),

  ('C', 'gainage_lateral', 'sans_halteres', 'Gainage latéral', 'Obliques', 3, '30s par côté', null, 30,
    'Appui sur un avant-bras et le côté du pied, corps aligné, hanches levées et maintenues en l''air.', 30),
  ('C', 'gainage_lateral', 'avec_halteres', 'Gainage latéral lesté', 'Obliques', 3, '20s par côté', null, 30,
    'Même position que le gainage latéral, avec un haltère posé sur la hanche pour augmenter la difficulté.', 30),

  ('C', 'releve_jambes', 'sans_halteres', 'Relevé de jambes', 'Abdominaux (bas du ventre)', 3, '15', null, 30,
    'Allongé sur le dos, jambes tendues, remonte les jambes à la verticale sans décoller le bas du dos, puis redescends lentement.', 40),
  ('C', 'releve_jambes', 'avec_halteres', 'Relevé de jambes avec haltère aux pieds', 'Abdominaux (bas du ventre)', 3, '12', null, 30,
    'Même mouvement que le relevé de jambes, avec un petit haltère coincé entre les pieds pour ajouter de la charge.', 40),

  ('C', 'mountain_climber', 'sans_halteres', 'Mountain climbers', 'Cardio, gainage', 3, null, 40, 20,
    'En position de planche haute, ramène rapidement les genoux vers la poitrine en alternant les jambes.', 50),
  ('C', 'mountain_climber', 'avec_halteres', 'Mountain climbers mains sur haltères', 'Cardio, gainage, épaules', 3, null, 30, 20,
    'Même mouvement que les mountain climbers, mains posées sur deux haltères pour surélever le buste et intensifier le travail des épaules.', 50),

  ('C', 'burpees', 'sans_halteres', 'Burpees', 'Cardio, corps entier', 3, null, 30, 30,
    'Départ debout, descends en squat, place les mains au sol, envoie les jambes en planche, reviens et saute en l''air.', 60),
  ('C', 'burpees', 'avec_halteres', 'Burpees avec haltères', 'Cardio, corps entier', 3, null, 30, 40,
    'Même enchaînement que le burpee classique, en tenant un haltère léger dans chaque main pendant tout le mouvement.', 60);

-- ============================================================================
-- Fin du schéma
-- ============================================================================
