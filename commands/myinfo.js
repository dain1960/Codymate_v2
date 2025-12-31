const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("내정보") // ✅ 커맨드 이름: myinfo
    .setDescription("내 성장/관계 정보를 확인합니다."),

  async execute(interaction) {
    const userId = interaction.user.id;

    /**
     * ✅ 안전 require
     * - profile.service.js가
     *   1) module.exports = { getMyProfile }
     *   2) module.exports = getMyProfile
     * 둘 중 뭐든 대응
     */
    const profileService = require("../services/profile.service");
    const getMyProfile =
      typeof profileService === "function"
        ? profileService
        : profileService.getMyProfile;

    if (typeof getMyProfile !== "function") {
      // 여기로 오면 profile.service.js export가 잘못된 거임
      throw new Error("profile.service.js에서 getMyProfile을 export하지 않았습니다.");
    }

    const profile = getMyProfile(userId);

    const adult = profile.user.adult_verified_at ? "완료" : "미완료";
    const exp = profile.wallet?.exp ?? 0;
    const ap = profile.wallet?.activity_point ?? 0;
    const cc = profile.wallet?.credit ?? 0;

    // 멘토
    let mentorText = "없음";
    if (profile.mentor.assignment) {
      mentorText = profile.mentor.assignment.mentor_user_id
        ? `<@${profile.mentor.assignment.mentor_user_id}>`
        : "멘토 없음 선택";
    }

    // 클랜
    let clanText = "없음";
    if (profile.clan) {
      clanText =
        `이름: **${profile.clan.name}**\n` +
        `내 역할: **${profile.clan.myRole}**\n` +
        `레벨: **${profile.clan.level}**\n` +
        `정원: **${profile.clan.currentCapacity} / ${profile.clan.maxCapacityByLevel ?? "?"}**`;
    }

    // 커플
    let coupleText = "없음";
    if (profile.couple?.type === "ACTIVE") {
      coupleText =
        `상대: <@${profile.couple.partnerId}>\n` +
        `커플ID: \`${profile.couple.coupleId}\`\n` +
        `역할명: ${profile.couple.roleName ?? "미설정"}\n` +
        `보이스: ${
          profile.couple.voiceChannelId ? `<#${profile.couple.voiceChannelId}>` : "미생성"
        }`;
    } else if (profile.couple?.type === "PENDING") {
      const isRequester = profile.couple.requesterId === userId;
      coupleText =
        `상태: **대기중(PENDING)**\n` +
        `요청ID: \`${profile.couple.requestId}\`\n` +
        (isRequester
          ? `내가 신청함 → <@${profile.couple.targetId}>`
          : `내가 받은 신청 ← <@${profile.couple.requesterId}>`);
    }

    const embed = new EmbedBuilder()
      .setTitle("📌 My Info")
      .setDescription(`대상: <@${userId}>`)
      .addFields(
        {
          name: "기본",
          value:
            `닉네임(DB): **${profile.user.user_nickname ?? "미설정"}**\n` +
            `계급: **${profile.user.rank}**\n` +
            `성인인증: **${adult}**`,
          inline: false,
        },
        {
          name: "지갑",
          value: `EXP: **${exp}**\n활동포인트: **${ap}**\nCC: **${cc}**`,
          inline: false,
        },
        {
          name: "멘토",
          value: `내 멘토: ${mentorText}\n내 멘티 수(ACTIVE): **${profile.mentor.menteeCount}**`,
          inline: false,
        },
        { name: "클랜", value: clanText, inline: false },
        { name: "커플", value: coupleText, inline: false }
      );

    // ✅ ephemeral 경고 해결: flags 사용
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
