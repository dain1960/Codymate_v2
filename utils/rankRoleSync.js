// utils/rankRoleSync.js
// ✅ DB rank 값에 맞게 "랭크 역할 1개만" 유지한다.
// - NONE / STARTER / MEMBER / CORE 중 1개만 가지도록 강제

function getRankRoleId(rank) {
    const map = {
      NONE: process.env.ROLE_NONE_ID,
      STARTER: process.env.ROLE_STARTER_ID,
      MEMBER: process.env.ROLE_MEMBER_ID,
      CREW: process.env.ROLE_CREW_ID,
      CORE: process.env.ROLE_CORE_ID,
    };
    return map[rank] || map.NONE;
  }
  
  function getAllRankRoleIds() {
    return [
      process.env.ROLE_NONE_ID,
      process.env.ROLE_STARTER_ID,
      process.env.ROLE_MEMBER_ID,
      process.env.ROLE_CREW_ID,
      process.env.ROLE_CORE_ID,
    ].filter(Boolean);
  }
  
  /**
   * ✅ 실제 역할 체크 → 랭크 역할 정리 → 목표 랭크 역할 1개만 유지
   */
  async function syncRankRole(member, rank) {
    const targetRoleId = getRankRoleId(rank);
    const allRankRoleIds = getAllRankRoleIds();
    if (!targetRoleId) return;
  
    // 1) 다른 랭크 역할 제거
    for (const rid of allRankRoleIds) {
      if (rid !== targetRoleId && member.roles.cache.has(rid)) {
        await member.roles.remove(rid, "Cody: rank 동기화 - 다른 랭크 역할 제거");
      }
    }
  
    // 2) 목표 랭크 역할 부여
    if (!member.roles.cache.has(targetRoleId)) {
      await member.roles.add(targetRoleId, "Cody: rank 동기화 - 목표 랭크 역할 부여");
    }
  }
  
  module.exports = { syncRankRole };