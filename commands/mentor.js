// commands/mentor.js
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    EmbedBuilder,
  } = require("discord.js");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("멘토")
      .setDescription("멘토를 지정하거나(선택) / 지정하지 않기(스킵) 패널을 엽니다."),
  
    async execute(interaction) {
      // ✅ 멘토 지정 채널 제한 (환경변수로 관리 추천)
      const mentorChannelId = process.env.MENTOR_CHANNEL_ID;
      if (mentorChannelId && interaction.channelId !== mentorChannelId) {
        return interaction.reply({
          content: "이 명령어는 멘토지정 채널에서만 사용할 수 있어요.",
          flags: MessageFlags.Ephemeral,
        });
      }
  
      const embed = new EmbedBuilder()
        .setTitle("멘토 지정")
        .setDescription(
          [
            "원하면 멘토를 지정할 수 있어요. (선택 사항)",
            "",
            "- 멘토는 **멘티 정원 3명**이 차면 선택할 수 없어요.",
            "- 멘토는 **MEMBER 이상**만 가능해요.",
            "- **'멘토 지정 안 함'을 누르면 이후 변경 불가**로 처리할게요.",
          ].join("\n")
        );
  
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("mentor:open_select")
          .setLabel("멘토 지정")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("mentor:skip")
          .setLabel("멘토 지정 안 함")
          .setStyle(ButtonStyle.Secondary)
      );
  
      // ✅ 채널에 공개로 남기고 싶으면 Ephemeral 빼면 됨
      return interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    },
  };
  