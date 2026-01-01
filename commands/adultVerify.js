// commands/adultVerify.js
const { SlashCommandBuilder } = require("discord.js");
const { openAdultVerifyPanel } = require("../services/adultVerify.service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("성인인증")
    .setDescription("지정된 성인인증 채널에서 성인인증을 완료합니다."),
  async execute(interaction) {
    await openAdultVerifyPanel(interaction);
  },
};
