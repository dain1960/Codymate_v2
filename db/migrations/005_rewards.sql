-- =========================
-- EXP / POINT / CREDIT LOG
-- =========================
CREATE TABLE IF NOT EXISTS exp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  channel_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_point_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  channel_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  channel_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================
-- ACTIVITY / MEDIA / DAILY LIMIT
-- =========================
CREATE TABLE IF NOT EXISTS activity_submissions (
  submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  submitter_user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_submissions (
  media_id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_chat_reward (
  user_id TEXT NOT NULL,
  date_kst TEXT NOT NULL,
  minutes_awarded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_kst)
);

CREATE TABLE IF NOT EXISTS daily_voice_reward (
  user_id TEXT NOT NULL,
  date_kst TEXT NOT NULL,
  minutes_awarded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_kst)
);