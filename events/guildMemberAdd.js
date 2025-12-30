module.exports = {
    name: "guildMemberAdd",
    async execute(member) {
      console.log(`👤 신규 입장: ${member.user.tag}`);
    },
  };
  