-- =========================
-- MENTOR ASSIGNMENTS
-- - 멘티는 멘토 1회만 지정
-- =========================
CREATE TABLE IF NOT EXISTS mentor_assignments (
  mentee_user_id TEXT PRIMARY KEY,
  mentor_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  channel_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mentee_user_id) REFERENCES users(user_id),
  FOREIGN KEY (mentor_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentor
ON mentor_assignments(mentor_user_id);

-- =========================
-- TRIGGER: 멘토는 ACTIVE 멘티 3명까지
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_mentor_limit_3
BEFORE INSERT ON mentor_assignments
WHEN NEW.mentor_user_id IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT COUNT(*)
        FROM mentor_assignments
        WHERE mentor_user_id = NEW.mentor_user_id
          AND status = 'ACTIVE'
      ) >= 3
      THEN RAISE(ABORT, 'MENTOR_LIMIT_REACHED')
    END;
END;

-- =========================
-- TRIGGER: 멘토는 MEMBER 이상
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_mentor_rank_min_member
BEFORE INSERT ON mentor_assignments
WHEN NEW.mentor_user_id IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM users WHERE user_id = NEW.mentor_user_id) = 0
      THEN RAISE(ABORT, 'MENTOR_NOT_FOUND')
    END;

  SELECT
    CASE
      WHEN (
        SELECT rank FROM users WHERE user_id = NEW.mentor_user_id
      ) NOT IN ('MEMBER', 'CREW', 'CORE')
      THEN RAISE(ABORT, 'MENTOR_RANK_LIMIT')
    END;
END;