-- ============================================================
-- MERIDIAN · Projektová inteligence — schéma pro Supabase
-- Spusťte celý tento skript v Supabase → SQL Editor → New query → Run.
-- ============================================================

-- Jedna univerzální tabulka pro všechny entity projektu.
-- Každý řádek = jeden objekt (milník, schůzka, otázka, rozhodnutí, úkol,
-- riziko, důkaz), plus meta řádky pro projekt a osoby.
-- Celý objekt se ukládá jako JSONB v sloupci "data" — schéma tak přesně
-- odpovídá datovým objektům v aplikaci a je pružné vůči budoucím polím.

create table if not exists public.pi_entities (
  project_id text  not null,
  entity     text  not null,   -- 'project' | 'people' | 'milestone' | 'meeting' | 'question' | 'decision' | 'task' | 'risk' | 'evidence'
  id         text  not null,   -- ID entity (M4, Q-03, uid…) nebo 'meta' pro projekt/osoby
  sort       int   not null default 0,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, entity, id)
);

create index if not exists pi_entities_project_idx on public.pi_entities (project_id, entity, sort);

-- ============================================================
-- ŘÍZENÍ PŘÍSTUPU (RLS)
-- ============================================================
alter table public.pi_entities enable row level security;

-- ------------------------------------------------------------
-- VARIANTA A — rychlý start (VÝCHOZÍ):
-- Anonymní klíč smí číst i zapisovat. Vhodné pro interní tým na
-- neveřejné URL. POZOR: kdokoli se znalostí URL a anon klíče může data
-- upravit. Pro ostrý provoz přejděte na variantu B.
-- ------------------------------------------------------------
drop policy if exists pi_all_anon on public.pi_entities;
create policy pi_all_anon on public.pi_entities
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- VARIANTA B — bezpečnější (doporučeno později):
-- Čtení pro kohokoli, zápis jen pro přihlášené uživatele (Supabase Auth).
-- Nejprve zakomentujte VARIANTU A výše, pak odkomentujte blok níže.
-- ------------------------------------------------------------
-- drop policy if exists pi_all_anon on public.pi_entities;
-- create policy pi_read on public.pi_entities
--   for select to anon, authenticated using (true);
-- create policy pi_write on public.pi_entities
--   for all to authenticated using (true) with check (true);

-- ============================================================
-- Hotovo. Po spuštění:
-- 1) Zkopírujte Project URL a anon public key (Settings → API).
-- 2) Vložte je v index.html do bloku SUPA = { url, anonKey }.
-- 3) Při prvním načtení s vyplněným SUPA aplikace sama nahraje
--    výchozí demo obsah do tabulky (nebo nechte prázdné a naplňte ručně).
-- ============================================================
