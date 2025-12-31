// events/guildMemberAdd.js
// ✅ 입장 시 DB 상태로 "인증 재시작" 또는 "랭크 역할 동기화" 수행

const {
  getOrCreateUser,
  getOnboardingSnapshot,
  resetOnboardingToNone,
  getUserRank,
} = require("../db/user.model");
const { syncRankRole } = require("../utils/rankRoleSync");

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    try {
      console.log(`👤 신규 입장: ${member.user.tag}`);

      // 1) DB 확인 및 생성 (기본 row 보장)
      getOrCreateUser(member.id);

      // 2) 닉네임/성인/멘토(인물지정 or 없음선택) 입력 여부 확인
      const snap = getOnboardingSnapshot(member.id);

      // 3) 하나라도 비어있으면 -> 전부 NULL + rank=NONE -> 랭크 역할 동기화 -> 인증 재시작
      if (!snap.complete) {
        resetOnboardingToNone(member.id);

        // 역할은 NONE으로 강제 (랭크 역할 4개 중 1개만 유지)
        await syncRankRole(member, "NONE");

        console.log(`🔁 온보딩 불완전 → NONE 초기화 + 재시작: ${member.user.tag}`);
        return;
      }

      // 4) 입력이 모두 확인되면 -> DB rank 가져옴 -> 역할 동기화
      const rank = getUserRank(member.id);
      await syncRankRole(member, rank);

      console.log(`✅ 온보딩 완료 상태 → 랭크 역할 동기화: ${member.user.tag} (${rank})`);
    } catch (e) {
      console.error("❌ guildMemberAdd error:", e);
    }
  },
};