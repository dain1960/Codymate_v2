// events/interactionCreate.js
const {
  MessageFlags,
  ActionRowBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

const { assignMentor, skipMentor } = require("../db/mentor.model");
const { handleAdultVerifyButton } = require("../services/adultVerify.service");

/**
 * DB(더 정확히는 better-sqlite3 트리거/제약)에서 터진 에러를
 * 유저가 이해할 수 있는 문장으로 변환하는 함수
 */
function mapSqliteError(e) {
  const msg = String(e?.message || "");

  if (msg.includes("MENTOR_LIMIT_REACHED"))
    return "멘토 멘티 정원이 이미 3명이라 선택할 수 없어요.";
  if (msg.includes("MENTOR_RANK_LIMIT"))
    return "선택한 유저는 멘토 계급(MEMBER 이상)이 아니에요.";
  if (msg.includes("MENTOR_NOT_FOUND"))
    return "선택한 유저가 DB에 없어요. (먼저 서버 가입/DB생성 필요)";
  if (msg.includes("UNIQUE") || msg.includes("PRIMARY"))
    return "이미 멘토 선택이 완료된 상태예요. (변경 불가)";
  return null;
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    try {
      /**
       * 1) 슬래시 커맨드 처리
       */
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.client.commands?.get(interaction.commandName);
        if (!cmd) return;
        await cmd.execute(interaction);
        return;
      }

      /**
       * 2) 버튼 처리
       * - 성인인증 버튼 / 멘토 버튼을 "완전히 분리"해서
       *   서로 채널 제한이 섞이지 않게 한다.
       */
      if (interaction.isButton()) {
        const id = interaction.customId;

        /**
         * 2-A) 성인인증 버튼들 (adult: 로 시작)
         * - 여기서는 "성인인증 채널"만 검사하고,
         * - 바로 서비스 함수로 넘겨서 처리하고 return 한다.
         * - (중요) return을 확실히 해서 아래 멘토 로직으로 내려가지 않게 함
         */
        if (id.startsWith("adult:")) {
          const adultChannelId = process.env.ADULT_VERIFY_CHANNEL_ID;

          if (adultChannelId && interaction.channelId !== adultChannelId) {
            return interaction.reply({
              content: `성인인증은 지정된 채널에서만 진행할 수 있어요. <#${adultChannelId}>`,
              flags: MessageFlags.Ephemeral,
            });
          }

          // 성인인증 실제 처리(권한 확인/DB 업데이트 등)는 서비스에서 처리
          return handleAdultVerifyButton(interaction);
        }

        /**
         * 2-B) 멘토 버튼들 (mentor: 로 시작)
         * - 여기서는 "멘토 채널"만 검사한다.
         */
        if (id.startsWith("mentor:")) {
          const mentorChannelId = process.env.MENTOR_CHANNEL_ID;

          if (mentorChannelId && interaction.channelId !== mentorChannelId) {
            return interaction.reply({
              content: "멘토지정 채널에서만 진행할 수 있어요.",
              flags: MessageFlags.Ephemeral,
            });
          }

          // (A) "멘토 지정" 버튼 → 유저 선택 메뉴 띄우기
          if (id === "mentor:open_select") {
            const row = new ActionRowBuilder().addComponents(
              new UserSelectMenuBuilder()
                .setCustomId("mentor:select_user")
                .setPlaceholder("멘토로 지정할 유저를 선택해주세요.")
                .setMinValues(1)
                .setMaxValues(1)
            );

            return interaction.reply({
              content: "멘토를 선택해주세요.",
              components: [row],
              flags: MessageFlags.Ephemeral,
            });
          }

          // (B) "멘토 지정 안 함" 버튼 → DB에 스킵 저장
          if (id === "mentor:skip") {
            const menteeId = interaction.user.id;
            const res = skipMentor(menteeId, interaction.channelId);

            if (!res.ok && res.reason === "ALREADY_DECIDED") {
              return interaction.reply({
                content: "이미 멘토 선택이 완료된 상태예요. (변경 불가)",
                flags: MessageFlags.Ephemeral,
              });
            }

            return interaction.reply({
              content: "✅ 멘토를 지정하지 않기로 선택했어요. (이후 변경 불가)",
              flags: MessageFlags.Ephemeral,
            });
          }

          // mentor: 로 시작하지만 우리가 모르는 버튼이면 조용히 무시
          return;
        }

        // adult: 도 mentor: 도 아닌 다른 버튼은 지금은 무시
        return;
      }

      /**
       * 3) 유저 선택 메뉴 처리 (멘토 선택)
       */
      if (interaction.isUserSelectMenu()) {
        if (interaction.customId !== "mentor:select_user") return;

        const mentorChannelId = process.env.MENTOR_CHANNEL_ID;
        if (mentorChannelId && interaction.channelId !== mentorChannelId) {
          return interaction.reply({
            content: "멘토지정 채널에서만 진행할 수 있어요.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const menteeId = interaction.user.id;
        const mentorId = interaction.values?.[0]; // 선택된 유저 id (1개)

        // 1) 자기 자신 멘토 금지
        if (mentorId === menteeId) {
          return interaction.reply({
            content: "자기 자신은 멘토로 지정할 수 없어요.",
            flags: MessageFlags.Ephemeral,
          });
        }

        // 2) 봇(앱) 멘토 금지
        // - 선택 메뉴로 봇이 찍힐 수도 있어서 실제 멤버를 fetch 해서 막는다.
        const mentorMember = await interaction.guild.members
          .fetch(mentorId)
          .catch(() => null);

        if (!mentorMember) {
          return interaction.reply({
            content: "선택한 유저 정보를 가져올 수 없어요. 다시 시도해 주세요.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (mentorMember.user.bot) {
          return interaction.reply({
            content: "봇(앱)은 멘토로 지정할 수 없어요.",
            flags: MessageFlags.Ephemeral,
          });
        }

        try {
          const res = assignMentor(menteeId, mentorId, interaction.channelId);

          if (!res.ok && res.reason === "ALREADY_DECIDED") {
            return interaction.reply({
              content: "이미 멘토 선택이 완료된 상태예요. (변경 불가)",
              flags: MessageFlags.Ephemeral,
            });
          }

          return interaction.reply({
            content: `✅ 멘토 지정 완료! <@${mentorId}>`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (e) {
          const friendly = mapSqliteError(e);
          return interaction.reply({
            content: friendly || "처리 중 오류가 발생했어요.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } catch (e) {
      console.error(e);

      // interaction 타입에 따라 reply가 불가할 수 있으니 조심
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "처리 중 오류가 발생했습니다.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
