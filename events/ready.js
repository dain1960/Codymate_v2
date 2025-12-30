module.exports = {
    name: "ready",
    once: true, // 한 번만 실행되는 이벤트
    execute(client) {
      console.log(`✅ 봇 로그인 완료: ${client.user.tag}`);
    },
  };
  