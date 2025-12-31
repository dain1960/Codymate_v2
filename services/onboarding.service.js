// services/onboarding.service.js
/**
 * tryCompleteOnboarding()
 * ======================
 * 목적:
 * - 온보딩 3요소(성인인증/멘토지정/닉네임설정)가 "전부 입력되었는지" DB로 확인한다.
 * - 전부 완료되었고, 아직 rank가 NONE이면 => rank를 STARTER로 승급(처음 1회만)
 * - 승급 직후 => (선택) 스타터 보상 지급 + 랭크 역할 동기화
 *
 * 왜 필요한가?
 * - 성인인증/멘토/닉네임은 각각 다른 코드에서 처리되는데,
 *   완료 체크/승급/역할동기화를 여기저기 분산하면 버그가 폭발한다.
 * - 그래서 "완료 판정 + 승급 + 동기화"를 이 함수 하나로 통일한다.
 */

const { db } = require("../db/client");

// ✅ 너가 만든 user.model.js에서 아래 함수들이 있어야 함
// - getOrCreateUser(userId)
// - getOnboardingSnapshot(userId)  // 3요소 완료 여부 + (멘토는 '없음 선택'도 입력 완료로 인정)
// - getUserRank(userId)
// - setUserRank(userId, rank)
const {
  getOrCreateUser,
  getOnboardingSnapshot,
  getUserRank,
  setUserRank,
} = require("../db/user.model");

// ✅ 랭크 역할을 "NONE/STARTER/MEMBER/CREW/CORE 중 1개만" 유지시키는 유틸
// (네가 만든 utils/rankRoleSync.js)
const { syncRankRole } = require("../utils/rankRoleSync");

/**
 * (선택) 스타터 보상 지급
 * ---------------------
 * 지금은 "보상 수치"가 확정되지 않았으니 기본 0으로 둔다.
 * 나중에 정책이 정해지면 STARTER_REWARD_* 상수만 바꾸면 됨.
 *
 * 로그 테이블(exp_log/credit_log)은 005_rewards.sql에 있음.
 * - channel_id가 NOT NULL이므로, 호출한 채널이 없으면 "SYSTEM" 같은 값으로라도 넣어줘야 함.
 */
const STARTER_REWARD_EXP = 0;
const STARTER_REWARD_CC = 0;

const addStarterRewardTx = db.transaction((userId, channelId) => {
  // 1) wallets 총합 업데이트
  if (STARTER_REWARD_EXP !== 0 || STARTER_REWARD_CC !== 0) {
    db.prepare(`
      UPDATE wallets
      SET exp = exp + ?,
          credit = credit + ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(STARTER_REWARD_EXP, STARTER_REWARD_CC, userId);
  }

  // 2) 원장 로그(선택)
  // 보상 수치가 0이면 로그도 굳이 안 남김(깔끔)
  if (STARTER_REWARD_EXP !== 0) {
    db.prepare(`
      INSERT INTO exp_log (user_id, delta, source_type, source_id, channel_id)
      VALUES (?, ?, 'STARTER_GRANT', NULL, ?)
    `).run(userId, STARTER_REWARD_EXP, channelId);
  }

  if (STARTER_REWARD_CC !== 0) {
    db.prepare(`
      INSERT INTO credit_log (user_id, delta, source_type, source_id, channel_id)
      VALUES (?, ?, 'STARTER_GRANT', NULL, ?)
    `).run(userId, STARTER_REWARD_CC, channelId);
  }
});

/**
 * tryCompleteOnboarding
 * ---------------------
 * @param {object} params
 * @param {string} params.userId - 대상 유저 id (필수)
 * @param {import("discord.js").GuildMember} [params.member] - 역할 동기화까지 하고 싶을 때(선택)
 * @param {string} [params.channelId] - 로그/감사용 채널 id (선택, 없으면 "SYSTEM")
 *
 * @returns {object} 결과
 * - completed: boolean (3요소 완료 여부)
 * - promoted: boolean (이번 호출로 NONE->STARTER 승급이 일어났는지)
 * - rank: string (최종 rank)
 * - snapshot: 온보딩 상태 스냅샷(디버그용)
 */
async function tryCompleteOnboarding({ userId, member, channelId }) {
  const safeChannelId = channelId || "SYSTEM";

  // 0) DB row 보장 (없으면 생성)
  // - 이 한 줄로 "처음 명령어 친 사람도" 항상 users/wallets가 존재하게 됨
  getOrCreateUser(userId);

  // 1) 온보딩 3요소 완료 여부 확인
  // - nicknameOk/adultOk/mentorOk를 내부에서 판단
  // - 멘토는 "없음 선택"도 입력 완료로 인정하도록 구현돼 있어야 함
  const snapshot = getOnboardingSnapshot(userId);

  // 2) 아직 3요소가 다 안 끝났으면 => 아무 것도 하지 않음
  if (!snapshot.complete) {
    return {
      completed: false,
      promoted: false,
      rank: getUserRank(userId),
      snapshot,
    };
  }

  // 3) 3요소 완료 상태면 => 현재 rank 확인
  const currentRank = getUserRank(userId);

  // 4) "처음 인증 완료" 정책: NONE이면 STARTER로 올린다 (딱 1회)
  // - 이미 STARTER 이상이면 여기서 중복 승급/중복 지급 안 하도록 방어
  let promoted = false;

  if (currentRank === "NONE") {
    setUserRank(userId, "STARTER");
    promoted = true;

    // 4-1) 스타터 보상 지급(선택)
    // - 보상 수치가 확정되기 전이니 현재는 기본 0(실질 지급 없음)
    // - 나중에 STARTER_REWARD_EXP/CC만 변경하면 자동 적용됨
    addStarterRewardTx(userId, safeChannelId);
  }

  // 5) 디스코드 역할 동기화 (member가 들어온 경우에만)
  // - 우리 규칙: 랭크 역할은 NONE/STARTER/MEMBER/CREW/CORE 중 1개만 유지
  // - 승급이 없었어도, "역할이 꼬인 상태"를 바로잡는 데 유용
  const finalRank = getUserRank(userId);

  if (member) {
    await syncRankRole(member, finalRank);
  }

  return {
    completed: true,
    promoted,
    rank: finalRank,
    snapshot,
  };
}

module.exports = { tryCompleteOnboarding };