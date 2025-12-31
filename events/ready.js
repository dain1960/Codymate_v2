module.exports = {
  name: "clientReady", // ✅ 변경
  once: true,
  execute(client) {
    console.log(`✅ 봇 로그인 완료: ${client.user.tag}`);
  },
};