// db/mentor.model.js
const { db } = require("./client");

/**
 * 멘티가 이미 멘토를 선택했는지(지정/스킵 포함) 확인
 * - mentor_assignments 테이블은 mentee_user_id가 PK라서 "한 번만" 저장 가능
 */
const selectAssignmentStmt = db.prepare(`
  SELECT mentee_user_id, mentor_user_id, status, channel_id, created_at
  FROM mentor_assignments
  WHERE mentee_user_id = ?
`);

/**
 * 멘토 지정
 * - 트리거가 알아서 검증함:
 *   1) 멘토 ACTIVE 멘티 3명 제한 (MENTOR_LIMIT_REACHED)
 *   2) 멘토 rank MEMBER 이상 제한 (MENTOR_RANK_LIMIT)
 * - 이미 mentee_user_id가 있으면(=이미 선택 완료) UNIQUE/PK로 실패
 */
const insertAssignStmt = db.prepare(`
  INSERT INTO mentor_assignments (mentee_user_id, mentor_user_id, status, channel_id)
  VALUES (?, ?, 'ACTIVE', ?)
`);

/**
 * 멘토 지정 안 함(스킵)
 * - mentor_user_id는 NULL로 저장 (트리거 조건: NEW.mentor_user_id IS NOT NULL 이라서 검증/제한에 안 걸림)
 * - status는 'SKIPPED'로 저장해서 "선택 완료(변경 불가)"로 취급 가능
 */
const insertSkipStmt = db.prepare(`
  INSERT INTO mentor_assignments (mentee_user_id, mentor_user_id, status, channel_id)
  VALUES (?, NULL, 'SKIPPED', ?)
`);

function getMentorAssignment(menteeUserId) {
  return selectAssignmentStmt.get(menteeUserId) || null;
}

function assignMentor(menteeUserId, mentorUserId, channelId) {
  const tx = db.transaction(() => {
    const existing = getMentorAssignment(menteeUserId);
    if (existing) return { ok: false, reason: "ALREADY_DECIDED", existing };

    insertAssignStmt.run(menteeUserId, mentorUserId, channelId);
    return { ok: true, assignment: getMentorAssignment(menteeUserId) };
  });

  return tx();
}

function skipMentor(menteeUserId, channelId) {
  const tx = db.transaction(() => {
    const existing = getMentorAssignment(menteeUserId);
    if (existing) return { ok: false, reason: "ALREADY_DECIDED", existing };

    insertSkipStmt.run(menteeUserId, channelId);
    return { ok: true, assignment: getMentorAssignment(menteeUserId) };
  });

  return tx();
}

module.exports = {
  getMentorAssignment,
  assignMentor,
  skipMentor,
};
