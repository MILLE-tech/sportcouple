-- ============================================================================
-- Migration 0003 — Séance bonus (corps complet) + suivi des pas quotidiens
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase, EN PLUS de schema.sql et de la
-- migration 0002 (déjà exécutées).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Séance D — Bonus, corps complet (haut + bas + cardio), optionnelle.
-- ----------------------------------------------------------------------------

insert into public.workout_session_types (code, name, focus, sort_order) values
  ('D', 'Séance Bonus', 'Corps complet (haut + bas + cardio) — optionnelle', 40);

insert into public.exercises
  (session_code, exercise_group, variant, name, target_muscles, sets, reps, duration_seconds, rest_seconds, description, sort_order)
values
  ('D', 'squat', 'sans_halteres', 'Squat au poids du corps', 'Fessiers, quadriceps, ischio-jambiers', 3, '15-20', null, 45,
    'Pieds largeur d''épaules, descends en poussant les hanches vers l''arrière, genoux alignés avec les orteils, remonte en poussant sur les talons.', 10),
  ('D', 'squat', 'avec_halteres', 'Goblet squat avec haltère', 'Fessiers, quadriceps, ischio-jambiers', 3, '12-15', null, 60,
    'Tiens un haltère à deux mains contre la poitrine, descends en squat en gardant le buste droit, remonte en poussant sur les talons.', 10),

  ('D', 'fente', 'sans_halteres', 'Fentes avant alternées', 'Fessiers, quadriceps', 3, '12 par jambe', null, 45,
    'Fais un grand pas en avant, descends jusqu''à ce que les deux genoux forment un angle de 90°, reviens et alterne les jambes.', 20),
  ('D', 'fente', 'avec_halteres', 'Fentes avant avec haltères', 'Fessiers, quadriceps', 3, '10 par jambe', null, 60,
    'Un haltère dans chaque main le long du corps, réalise des fentes avant en gardant le buste droit et le genou arrière proche du sol.', 20),

  ('D', 'pompes', 'sans_halteres', 'Pompes', 'Pectoraux, triceps, épaules', 3, '8-15', null, 60,
    'Mains légèrement plus larges que les épaules, corps gainé en ligne droite, descends la poitrine vers le sol puis repousse.', 30),
  ('D', 'pompes', 'avec_halteres', 'Développé couché au sol avec haltères', 'Pectoraux, triceps, épaules', 3, '12', null, 60,
    'Allongé au sol, un haltère dans chaque main au-dessus de la poitrine, descends les coudes vers le sol puis repousse les haltères vers le haut.', 30),

  ('D', 'dos_superman', 'sans_halteres', 'Superman (extension dorsale)', 'Dos, fessiers', 3, '15', null, 45,
    'Allongé sur le ventre, lève simultanément bras et jambes tendus, maintiens 1-2 secondes puis redescends.', 40),
  ('D', 'dos_superman', 'avec_halteres', 'Rowing haltère buste penché', 'Dos, biceps', 3, '12', null, 60,
    'Buste penché en avant, dos droit, tire les haltères vers les hanches en serrant les omoplates, puis redescends contrôlé.', 40),

  ('D', 'planche', 'sans_halteres', 'Planche (gainage)', 'Sangle abdominale, gainage', 3, null, 40, 30,
    'Appui sur les avant-bras et les pointes de pieds, corps aligné de la tête aux talons, contracte les abdominaux.', 50),
  ('D', 'planche', 'avec_halteres', 'Planche lestée', 'Sangle abdominale, gainage', 3, null, 30, 30,
    'Même position que la planche classique, avec un haltère posé sur le bas du dos pour ajouter de la difficulté.', 50),

  ('D', 'burpees', 'sans_halteres', 'Burpees', 'Cardio, corps entier', 3, null, 30, 30,
    'Départ debout, descends en squat, place les mains au sol, envoie les jambes en planche, reviens et saute en l''air.', 60),
  ('D', 'burpees', 'avec_halteres', 'Burpees avec haltères', 'Cardio, corps entier', 3, null, 30, 40,
    'Même enchaînement que le burpee classique, en tenant un haltère léger dans chaque main pendant tout le mouvement.', 60);

-- ----------------------------------------------------------------------------
-- Pas quotidiens.
-- ----------------------------------------------------------------------------

create table public.daily_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_on date not null default current_date,
  steps int not null check (steps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create index daily_steps_user_date_idx on public.daily_steps (user_id, recorded_on);

alter table public.daily_steps enable row level security;

create policy "daily_steps_select" on public.daily_steps
  for select using (public.can_view_user_data(user_id));
create policy "daily_steps_insert" on public.daily_steps
  for insert with check (user_id = auth.uid());
create policy "daily_steps_update" on public.daily_steps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_steps_delete" on public.daily_steps
  for delete using (user_id = auth.uid());

-- ============================================================================
-- Fin de la migration 0003
-- ============================================================================
