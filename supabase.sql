-- ══════════════════════════════════════════════════════════════════
--  NovaCiné — Schéma Supabase complet
--  Exécutez ce script dans Supabase > SQL Editor > New query
-- ══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════
--  TABLE : films
-- ════════════════════════════════
CREATE TABLE IF NOT EXISTS films (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  description text,
  image_url   text,
  video_url   text        NOT NULL,
  genre       text,
  year        integer,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════
--  TABLE : series
-- ════════════════════════════════
CREATE TABLE IF NOT EXISTS series (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  description text,
  image_url   text,
  genre       text,
  year        integer,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════
--  TABLE : episodes
-- ════════════════════════════════
CREATE TABLE IF NOT EXISTS episodes (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id      uuid        NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  episode_number integer     DEFAULT 1,
  season_number  integer     DEFAULT 1,
  video_url      text        NOT NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);

-- ════════════════════════════════
--  TABLE : users  (comptes locaux, hors Supabase Auth)
--  Le mot de passe est stocké hashé (SHA-256 côté client avant envoi)
-- ════════════════════════════════
CREATE TABLE IF NOT EXISTS nc_users (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  username     text        NOT NULL UNIQUE,
  password_hash text       NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- ════════════════════════════════
--  TABLE : progress  (progression par utilisateur)
-- ════════════════════════════════
CREATE TABLE IF NOT EXISTS progress (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES nc_users(id) ON DELETE CASCADE,
  -- contenu : soit un film soit un épisode
  film_id      uuid        REFERENCES films(id) ON DELETE CASCADE,
  episode_id   uuid        REFERENCES episodes(id) ON DELETE CASCADE,
  -- position en secondes
  position     float       DEFAULT 0,
  duration     float       DEFAULT 0,
  -- pourcentage visionné (0-100)
  percent      float       DEFAULT 0,
  -- marquer comme terminé si > 90%
  completed    boolean     DEFAULT false,
  updated_at   timestamptz DEFAULT now(),
  -- unicité : un user, un film ou un episode
  CONSTRAINT uq_progress_film    UNIQUE (user_id, film_id),
  CONSTRAINT uq_progress_episode UNIQUE (user_id, episode_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- ════════════════════════════════
--  RLS
-- ════════════════════════════════
ALTER TABLE films      ENABLE ROW LEVEL SECURITY;
ALTER TABLE series     ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nc_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress   ENABLE ROW LEVEL SECURITY;

-- Lecture/écriture publique (clé anon) — pour usage single-page app
-- ⚠️ En production sécurisée, remplacez par des JWT ou des politiques par user_id
CREATE POLICY "r_films"    ON films    FOR SELECT USING (true);
CREATE POLICY "w_films"    ON films    FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "r_series"   ON series   FOR SELECT USING (true);
CREATE POLICY "w_series"   ON series   FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "r_episodes" ON episodes FOR SELECT USING (true);
CREATE POLICY "w_episodes" ON episodes FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "r_users"    ON nc_users FOR SELECT USING (true);
CREATE POLICY "w_users"    ON nc_users FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "r_progress" ON progress FOR SELECT USING (true);
CREATE POLICY "w_progress" ON progress FOR ALL    USING (true) WITH CHECK (true);
