const { db } = require("./client");

/**
 * CREATE
 * 새로운 유저 생성
 * - 이미 존재하면 실패하거나 무시 (네가 결정)
 */
function createUser(userId) {
  // TODO:
  // INSERT INTO users ...
}

/**
 * READ
 * 유저 단건 조회
 */
function findUserById(userId) {
  // TODO:
  // SELECT * FROM users WHERE user_id = ?
}

/**
 * UPDATE
 * 유저 온보딩 단계 변경
 */
function updateUserStep(userId, step) {
  // TODO:
  // UPDATE users SET step = ? WHERE user_id = ?
}

/**
 * DELETE
 * 유저 삭제 (테스트/관리용)
 */
function deleteUser(userId) {
  // TODO:
  // DELETE FROM users WHERE user_id = ?
}

/**
 * UPSERT
 * - 유저가 없으면 생성
 * - 있으면 그대로 반환
 * 실무에서 가장 많이 쓰게 될 함수
 */
function getOrCreateUser(userId) {
  // TODO:
  // 1) INSERT OR IGNORE ...
  // 2) SELECT ...
}

module.exports = {
  createUser,
  findUserById,
  updateUserStep,
  deleteUser,
  getOrCreateUser,
};
