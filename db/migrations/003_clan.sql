-- =========================
-- CLAN LEVEL CAPS (레벨별 최대 상한)
-- =========================
CREATE TABLE IF NOT EXISTS clan_level_caps (
  level INTEGER PRIMARY KEY,
  max_capacity INTEGER NOT NULL
);

INSERT OR IGNORE INTO clan_level_caps (level, max_capacity) VALUES
  (1, 20),
  (2, 25),
  (3, 30),
  (4, 35),
  (5, 40);

-- =========================
-- CLANS
-- =========================
CREATE TABLE IF NOT EXISTS clans (
  clan_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  current_capacity INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id),
  FOREIGN KEY (level) REFERENCES clan_level_caps(level)
);

-- =========================
-- CLAN MEMBERS
-- - 유저는 클랜 1개만
-- =========================
CREATE TABLE IF NOT EXISTS clan_members (
  clan_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (clan_id, user_id),
  UNIQUE (user_id),
  FOREIGN KEY (clan_id) REFERENCES clans(clan_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =========================
-- TRIGGER: 클랜장 자동 가입
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_clan_owner_auto_join
AFTER INSERT ON clans
BEGIN
  INSERT INTO clan_members (clan_id, user_id, role)
  VALUES (NEW.clan_id, NEW.owner_user_id, 'OWNER');
END;

-- =========================
-- TRIGGER: 정원 초과 방지
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_clan_join_capacity_check
BEFORE INSERT ON clan_members
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT COUNT(*) FROM clan_members WHERE clan_id = NEW.clan_id
      ) >= (
        SELECT current_capacity FROM clans WHERE clan_id = NEW.clan_id
      )
      THEN RAISE(ABORT, 'CLAN_CAPACITY_FULL')
    END;
END;

-- =========================
-- TRIGGER: 레벨 상한 초과 방지
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_clan_capacity_not_over_level_cap
BEFORE UPDATE OF current_capacity ON clans
BEGIN
  SELECT
    CASE
      WHEN NEW.current_capacity > (
        SELECT max_capacity FROM clan_level_caps WHERE level = NEW.level
      )
      THEN RAISE(ABORT, 'CLAN_LEVEL_CAP_EXCEEDED')
    END;
END;