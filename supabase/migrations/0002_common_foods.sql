-- ============================================================================
-- Migration 0002 — Aliments courants (suggestions partagées pour Repas)
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase, EN PLUS de supabase/schema.sql
-- (déjà exécuté). Idempotent-safe uniquement sur une base qui ne possède pas
-- encore cette table.
-- ============================================================================

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
-- Fin de la migration 0002
-- ============================================================================
