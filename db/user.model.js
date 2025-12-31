const { db } = require("./client");

/**
 * =========================
 * PREPARED STATEMENTS
 * =========================
 */

// users 기본 생성 (있으면 무시)
const insertUserStmt = db.prepare(`
  INSERT OR IGNORE INTO users (user_id)
  VALUES (?)
`);

// wallets 기본 생성
const insertWalletStmt = db.prepare(`
  INSERT OR IGNORE INTO wallets (user_id, exp, activity_point, credit)
  VALUES (?, 0, 0, 0)
`);

// 닉네임 장식 기본 row 생성
const insertDecorationStmt = db.prepare(`
  INSERT OR IGNORE INTO user_nickname_decorations (user_id)
  VALUES (?)
`);

// 유저 조회
const selectUserStmt = db.prepare(`
  SELECT *
  FROM users
  WHERE user_id = ?
`);

/**
 * =========================
 * CREATE / READ
 * =========================
 */

/**
 * 유저 단건 조회
 * - 없으면 null
 */
function findUserById(userId) {
  return selectUserStmt.get(userId) || null;
}

/**
 * 유저 생성
 * - 실무에서는 거의 직접 호출 안 함
 * - getOrCreateUser 내부에서 사용
 */
function createUser(userId) {
  const tx = db.transaction((userId) => {
    insertUserStmt.run(userId);
    insertWalletStmt.run(userId);
    insertDecorationStmt.run(userId);
    return selectUserStmt.get(userId);
  });

  return tx(userId);
}

/**
 * =========================
 * UPDATE
 * =========================
 */

/**
 * 유저 계급 변경
 * - 인증 완료 → STARTER 지급
 * - 이후 승급 로직에서도 사용
 */
function updateUserRank(userId, rank) {
  const stmt = db.prepare(`
    UPDATE users
    SET rank = ?,
        updated_at = datetime('now')
    WHERE user_id = ?
  `);

  const res = stmt.run(rank, userId);
  return res.changes > 0;
}

/**
 * 성인 인증 완료 처리
 */
function setAdultVerified(userId) {
  const stmt = db.prepare(`
    UPDATE users
    SET adult_verified_at = datetime('now'),
        updated_at = datetime('now')
    WHERE user_id = ?
  `);

  stmt.run(userId);
}

/**
 * =========================
 * DELETE (테스트/관리용)
 * =========================
 */
function deleteUser(userId) {
  const tx = db.transaction((userId) => {
    db.prepare(`DELETE FROM user_nickname_decorations WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM wallets WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM mentor_assignments WHERE mentee_user_id = ?`).run(userId);
    db.prepare(`DELETE FROM mentor_assignments WHERE mentor_user_id = ?`).run(userId);
    // 클랜 / 커플 / 보상 로그는 필요 시 여기 추가
    db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);
  });

  tx(userId);
}

/**
 * =========================
 * ⭐ 핵심 함수 (실무에서 제일 많이 씀)
 * =========================
 */

/**
 * getOrCreateUser
 * - users / wallets / decorations 존재 보장
 * - FK 안전장치
 */
function getOrCreateUser(userId) {
  const tx = db.transaction((userId) => {
    insertUserStmt.run(userId);
    insertWalletStmt.run(userId);
    insertDecorationStmt.run(userId);
    const user = selectUserStmt.get(userId);
    if (!user) throw new Error("getOnCreateUser: users row를 찾지 못했습니다.");
    return user;
  });

  return tx(userId);
}

/**
 * ✅ 온보딩 3요소 상태 확인
 * - 멘토는 "인물지정" OR "없음 선택" 둘 다 '입력 완료'로 인정
 *   => mentor_assignments row 존재 여부로 판정 (mentor_user_id가 NULL이어도 OK)
 */
function getOnboardingSnapshot(userId) {
  const user = db.prepare(`
    SELECT user_id, rank, user_nickname, adult_verified_at
    FROM users
    WHERE user_id = ?
  `).get(userId);

  const mentorRow = db.prepare(`
    SELECT mentee_user_id, mentor_user_id
    FROM mentor_assignments
    WHERE mentee_user_id = ?
    LIMIT 1
  `).get(userId);

  const nicknameOk = !!(user?.user_nickname && String(user.user_nickname).trim());
  const adultOk = !!user?.adult_verified_at;
  const mentorOk = !!mentorRow; // ✅ 없음 선택 포함

  return {
    user,
    complete: nicknameOk && adultOk && mentorOk,
    nicknameOk,
    adultOk,
    mentorOk,
  };
}

/**
 * ✅ 불완전하면: 닉네임/성인/멘토 전부 NULL + rank=NONE
 * - 멘토는 row 삭제로 "미입력 상태"로 되돌림
 */
function resetOnboardingToNone(userId) {
  const tx = db.transaction((uid) => {
    db.prepare(`
      UPDATE users
      SET user_nickname = NULL,
          adult_verified_at = NULL,
          rank = 'NONE',
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(uid);

    db.prepare(`
      DELETE FROM mentor_assignments
      WHERE mentee_user_id = ?
    `).run(uid);
  });

  tx(userId);
}

function getUserRank(userId) {
  return db.prepare(`SELECT rank FROM users WHERE user_id = ?`).get(userId)?.rank ?? "NONE";
}

function setUserRank(userId, rank) {
  db.prepare(`
    UPDATE users
    SET rank = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `).run(rank, userId);
}

module.exports = {
  findUserById,
  createUser,
  updateUserRank,
  setAdultVerified,
  deleteUser,
  getOrCreateUser,
  getOnboardingSnapshot,
  resetOnboardingToNone,
  getUserRank,
  setUserRank,
};