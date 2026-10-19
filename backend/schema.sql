-- ==============================================================================
-- DATABASE SCHEMA & SAMPLE DATA (backend/schema.sql)
-- ==============================================================================
-- Project Theme: Question 9 — Sports Team Roster & Fixtures
-- Database: campus_crud
-- Table: sports
--
-- THE SINGLE-TABLE ARCHITECTURE EXPLAINED:
-- ------------------------------------------------------------------------------
-- This database structure demonstrates Single-Table Polymorphism.
-- Both "Players" (roster members) and "Fixtures" (match events) are stored in the
-- same table named `sports`.
--
-- CRUCIAL LOGIC: HOW NULL VALUES DISTINGUISH ENTITIES
-- 1. For Player records (Roster):
--    - `player_name`   -> Contains the athlete's name (VARCHAR)
--    - `position`      -> Contains their playing position, e.g. Forward, Midfielder (VARCHAR)
--    - `jersey_number` -> Contains their kit squad number (INT)
--
-- 2. For Fixture records (Scheduled Matches):
--    - `player_name`   -> IS NULL (A match event is an organizational fixture, not an athlete)
--    - `position`      -> IS NULL (A fixture does not have an on-pitch position)
--    - `jersey_number` -> IS NULL (A fixture does not wear a jersey number)
--
-- WHY STORE NULL INSTEAD OF EMPTY STRINGS?
-- In relational databases, NULL represents the intentional absence of data.
-- An empty string "" or 0 implies that a player exists who has no name or wears jersey #0.
-- Storing NULL explicitly denotes that player attributes are semantically non-existent
-- for that specific row.
-- ==============================================================================

-- 1. Create database if it does not already exist
CREATE DATABASE IF NOT EXISTS campus_crud;
USE campus_crud;

-- 2. Drop existing table for a clean, reproducible setup
DROP TABLE IF EXISTS sports;

-- 3. Create the single `sports` table
CREATE TABLE sports (
  -- Unique identifier for each record (auto-increments sequentially)
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Player attributes (NULL for fixture records)
  player_name VARCHAR(120) NULL COMMENT 'Player name (NULL for fixtures)',
  position VARCHAR(60) NULL COMMENT 'Tactical position e.g. Midfielder (NULL for fixtures)',
  jersey_number INT NULL COMMENT 'Kit squad number (NULL for fixtures)',

  -- Audit timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when record was inserted',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp when record was last updated'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 4. INSERT 10 SAMPLE RECORDS (MIXING PLAYERS AND FIXTURES)
-- ==============================================================================
-- Records 1 to 5: Squad Players (player_name, position, jersey_number populated)
-- Records 6 to 10: Match Fixtures (player_name, position, jersey_number are NULL)
-- ==============================================================================

INSERT INTO sports (player_name, position, jersey_number)
VALUES
  -- 5 Players on the Roster
  ('John Doe', 'Forward', 10),
  ('Jane Smith', 'Midfielder', 8),
  ('Mike Johnson', 'Defender', 4),
  ('Sarah Williams', 'Goalkeeper', 1),
  ('David Brown', 'Striker', 9),

  -- 5 Fixture Records (All player fields are explicitly NULL)
  (NULL, NULL, NULL),
  (NULL, NULL, NULL),
  (NULL, NULL, NULL),
  (NULL, NULL, NULL),
  (NULL, NULL, NULL);

-- ==============================================================================
-- 5. VERIFICATION QUERY
-- ==============================================================================
SELECT id, player_name, position, jersey_number, created_at, updated_at FROM sports;
