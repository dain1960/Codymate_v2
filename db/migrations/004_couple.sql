-- =========================
-- COUPLES
-- =========================
CREATE TABLE IF NOT EXISTS couples (
  couple_id TEXT PRIMARY KEY,
  user_low_id TEXT NOT NULL,
  user_high_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  role_id TEXT,
  role_name TEXT,
  voice_channel_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  CHECK (user_low_id < user_high_id),
  UNIQUE (user_low_id, user_high_id),
  UNIQUE (user_low_id),
  UNIQUE (user_high_id),
  FOREIGN KEY (user_low_id) REFERENCES users(user_id),
  FOREIGN KEY (user_high_id) REFERENCES users(user_id)
);

-- =========================
-- COUPLE REQUESTS
-- =========================
CREATE TABLE IF NOT EXISTS couple_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  user_low_id TEXT NOT NULL,
  user_high_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  channel_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (user_low_id < user_high_id),
  FOREIGN KEY (requester_user_id) REFERENCES users(user_id),
  FOREIGN KEY (target_user_id) REFERENCES users(user_id)
);

-- =========================
-- TRIGGER: 이미 커플이면 신청 불가
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_couple_request_block_if_already_coupled
BEFORE INSERT ON couple_requests
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM couples
        WHERE status = 'ACTIVE'
          AND (user_low_id IN (NEW.user_low_id, NEW.user_high_id)
           OR user_high_id IN (NEW.user_low_id, NEW.user_high_id))
      )
      THEN RAISE(ABORT, 'COUPLE_ALREADY_EXISTS')
    END;
END;

-- =========================
-- TRIGGER: 같은 쌍 PENDING 1개
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_couple_request_one_pending_per_pair
BEFORE INSERT ON couple_requests
WHEN NEW.status = 'PENDING'
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM couple_requests
        WHERE user_low_id = NEW.user_low_id
          AND user_high_id = NEW.user_high_id
          AND status = 'PENDING'
      )
      THEN RAISE(ABORT, 'COUPLE_REQUEST_ALREADY_PENDING')
    END;
END;

-- =========================
-- TRIGGER: 수락 시 커플 자동 생성
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_couple_request_accept_create_couple
AFTER UPDATE OF status ON couple_requests
WHEN NEW.status = 'ACCEPTED'
BEGIN
  INSERT INTO couples (couple_id, user_low_id, user_high_id)
  VALUES ('couple_req_' || NEW.request_id, NEW.user_low_id, NEW.user_high_id);
END;