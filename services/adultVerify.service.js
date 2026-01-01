// services/adultVerify.service.js
/**
 * 성인인증 서비스 (채널 기반 판정)
 * ===============================
 * 요구사항:
 * - 지정된 성인인증 채널에서만 진행
 * - 디스코드 권한 설정으로 "성인만 볼 수 있는 채널"을 만들고,
 *   그 채널을 볼 수 있으면 성인으로 판정한다.
 * - 그 채널 안에서 버튼을 누르면 DB에 adult_verified_at 저장
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionsBitField,
  } = require("discord.js");
  
  const { getOrCreateUser, setAdultVerified } = require("../db/user.model");
  const { tryCompleteOnboarding } = require("./onboarding.service");
  
  // 버튼 customId
  const BTN_ADULT_CONFIRM = "adult:confirm";
  
  function getAdultVerifyChannelId() {
    return process.env.ADULT_VERIFY_CHANNEL_ID;
  }
  
  /**
   * ✅ 유저가 "성인인증 채널을 볼 수 있는지" 서버가 직접 확인
   * - 채널이 존재해야 함
   * - member가 VIEW_CHANNEL 권한을 가져야 함
   */
  function canViewAdultChannel(member) {
    const channelId = getAdultVerifyChannelId();
    if (!channelId) return false;
  
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return false;
  
    const perms = channel.permissionsFor(member);
    if (!perms) return false;
  
    return perms.has(PermissionsBitField.Flags.ViewChannel);
  }
  
  /**
   * ✅ 성인인증 패널 열기 (/성인인증 커맨드에서 호출)
   * - 성인인증 채널에서만 실행되게 제한
   */
  async function openAdultVerifyPanel(interaction) {
    const channelId = getAdultVerifyChannelId();
  
    // 0) 환경변수 없으면 바로 안내
    if (!channelId) {
      return interaction.reply({
        content: "❌ ADULT_VERIFY_CHANNEL_ID가 설정되지 않았습니다.",
        flags: MessageFlags.Ephemeral,
      });
    }
  
    // 1) 이 명령어는 "성인인증 채널"에서만 허용
    if (interaction.channelId !== channelId) {
      return interaction.reply({
        content: `❌ 성인인증은 지정된 채널에서만 진행할 수 있습니다. <#${channelId}> 로 이동해 주세요.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  
    // 2) DB row 보장
    getOrCreateUser(interaction.user.id);
  
    // 3) 유저가 채널을 볼 권한이 있는지 다시 확인(운영 안전장치)
    // - 사실 여기서 이미 채널에 있으니 대부분 true지만,
    //   권한이 바뀌는 엣지케이스 대비
    if (!canViewAdultChannel(interaction.member)) {
      return interaction.reply({
        content: "❌ 이 채널을 볼 권한이 없습니다. (성인인증 불가)",
        flags: MessageFlags.Ephemeral,
      });
    }
  
    // 4) 버튼 패널 출력
    const embed = new EmbedBuilder()
      .setTitle("🔞 성인인증")
      .setDescription(
        [
          "이 채널을 볼 수 있는 권한이 확인되었습니다.",
          "아래 버튼을 누르면 성인인증이 완료됩니다.",
          "",
          "⚠️ 잘못 누를 경우 운영진에게 문의하세요.",
        ].join("\n")
      );
  
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(BTN_ADULT_CONFIRM)
        .setLabel("성인인증 완료")
        .setStyle(ButtonStyle.Success)
    );
  
    return interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }
  
  /**
   * ✅ 버튼 클릭 처리 (events/interactionCreate.js에서 호출)
   * - 버튼 클릭 시에도 채널/권한을 다시 검증하고 DB 업데이트
   */
  async function handleAdultVerifyButton(interaction) {
    const channelId = getAdultVerifyChannelId();
  
    // 0) 방어: 성인인증 채널에서만 처리
    if (!channelId || interaction.channelId !== channelId) {
      return interaction.reply({
        content: "❌ 성인인증 채널에서만 처리할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
    }
  
    // 1) DB row 보장
    const userId = interaction.user.id;
    getOrCreateUser(userId);
  
    // 2) 권한 검증: 채널 VIEW 권한이 있으면 성인으로 판정
    if (!canViewAdultChannel(interaction.member)) {
      return interaction.reply({
        content: "❌ 성인 채널을 볼 권한이 없어 인증할 수 없습니다.",
        flags: MessageFlags.Ephemeral,
      });
    }
  
    // 3) DB 성인인증 완료 처리 (adult_verified_at = now)
    setAdultVerified(userId);
  
    // 4) 온보딩 완료 체크(3요소 다 끝났으면 STARTER 승급 + 역할 동기화)
    const result = await tryCompleteOnboarding({
      userId,
      member: interaction.member,       // ✅ 역할 동기화까지
      channelId: interaction.channelId, // ✅ 로그/기록용
    });
  
    // 5) 버튼 중복 클릭 방지(비활성화) + 결과 안내
    const embed = new EmbedBuilder()
      .setTitle("✅ 성인인증 완료")
      .setDescription(
        result.promoted
          ? "온보딩 3개가 모두 완료되어 **STARTER**로 승급되었습니다."
          : "성인인증이 저장되었습니다. (남은 인증을 완료하면 STARTER로 승급됩니다.)"
      );
  
    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true)
    );
  
    return interaction.update({
      embeds: [embed],
      components: [disabledRow],
    });
  }
  
  module.exports = {
    openAdultVerifyPanel,
    handleAdultVerifyButton,
    BTN_ADULT_CONFIRM,
  };
  