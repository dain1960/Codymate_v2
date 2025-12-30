const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("pong 테스트"),
  async execute(interaction) {
    await interaction.reply("pong");
  },
};
