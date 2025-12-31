-- =========================================================
-- 001_core.sql
-- 핵심 테이블: users / wallets / nickname decorations
-- =========================================================

PRAGMA foreign_keys = ON;

-- -------------------------
-- users: 기본 사용자 상태
-- rank는 인증 완료 전 NONE 유지(너 정책)
-- -------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  user_nickname TEXT,
  rank TEXT NOT NULL DEFAULT 'NONE',
  adult_verified_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -------------------------
-- wallets: 현재 보유치(총합)
-- logs(원장)는 005_rewards에서 분리 관리
-- -------------------------
CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY,

  exp INTEGER NOT NULL DEFAULT 0,
  activity_point INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- -------------------------
-- user_nickname_decorations: 닉네임 앞/뒤 장식(아이템)
-- NULL이면 장식 없음
-- -------------------------
CREATE TABLE IF NOT EXISTS user_nickname_decorations (
  user_id TEXT PRIMARY KEY,

  prefix TEXT,
  suffix TEXT,

  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(user_id)
);