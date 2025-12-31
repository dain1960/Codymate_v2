// ⚠️ 여기 require 경로만 네 프로젝트 구조에 맞게 수정해
const { db } = require("../db/client.js"); // 예: db가 ./client.js 라면 이거 맞음
const { getOrCreateUser } = require("../db/user.model.js"); // 예: user.model.js가 루트면 이거 맞음

function getWallet(userId) {
  return db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(userId) || null;
}

function getMentorInfo(userId) {
  const assignment =
    db.prepare(`
      SELECT mentee_user_id, mentor_user_id, status
      FROM mentor_assignments
      WHERE mentee_user_id = ?
    `).get(userId) || null;

  const menteeCount =
    db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM mentor_assignments
      WHERE mentor_user_id = ?
        AND status = 'ACTIVE'
    `).get(userId)?.cnt ?? 0;

  return { assignment, menteeCount };
}

function getClanInfo(userId) {
  const membership = db.prepare(`
    SELECT clan_id, role
    FROM clan_members
    WHERE user_id = ?
  `).get(userId);

  if (!membership) return null;

  const clan = db.prepare(`
    SELECT clan_id, name, owner_user_id, level, current_capacity
    FROM clans
    WHERE clan_id = ?
  `).get(membership.clan_id);

  if (!clan) return null;

  const cap = db.prepare(`
    SELECT max_capacity
    FROM clan_level_caps
    WHERE level = ?
  `).get(clan.level);

  return {
    clanId: clan.clan_id,
    name: clan.name,
    ownerUserId: clan.owner_user_id,
    level: clan.level,
    currentCapacity: clan.current_capacity,
    maxCapacityByLevel: cap?.max_capacity ?? null,
    myRole: membership.role,
  };
}

function getCoupleInfo(userId) {
  const active = db.prepare(`
    SELECT couple_id, user_low_id, user_high_id, role_name, voice_channel_id
    FROM couples
    WHERE status = 'ACTIVE'
      AND (user_low_id = ? OR user_high_id = ?)
  `).get(userId, userId);

  if (active) {
    const partnerId = active.user_low_id === userId ? active.user_high_id : active.user_low_id;
    return {
      type: "ACTIVE",
      coupleId: active.couple_id,
      partnerId,
      roleName: active.role_name,
      voiceChannelId: active.voice_channel_id,
    };
  }

  const pending = db.prepare(`
    SELECT request_id, requester_user_id, target_user_id, created_at
    FROM couple_requests
    WHERE status = 'PENDING'
      AND (requester_user_id = ? OR target_user_id = ?)
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, userId);

  if (pending) {
    return {
      type: "PENDING",
      requestId: pending.request_id,
      requesterId: pending.requester_user_id,
      targetId: pending.target_user_id,
      createdAt: pending.created_at,
    };
  }

  return null;
}

// ✅ /myinfo 최종 조립
function getMyProfile(userId) {
  const user = getOrCreateUser(userId); // users/wallets 기본 row 보장
  const wallet = getWallet(userId);
  const mentor = getMentorInfo(userId);
  const clan = getClanInfo(userId);
  const couple = getCoupleInfo(userId);

  return { user, wallet, mentor, clan, couple };
}

// ✅ 이 한 줄이 핵심!
module.exports = { getMyProfile };
