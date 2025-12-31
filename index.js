const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config(); // ✅ .env 로드

function walkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walkJsFiles(full));
    else if (e.isFile() && e.name.endsWith(".js")) files.push(full);
  }
  return files;
}

function loadCommandExecutors() {
  const commandsDir = path.join(__dirname, "commands");
  const files = walkJsFiles(commandsDir);

  const map = new Collection();
  for (const file of files) {
    const mod = require(file);

    // ✅ 커맨드 형식 검증
    if (!mod?.data?.name || typeof mod.execute !== "function") {
      console.warn(`⚠️ 커맨드 형식 아님. 스킵: ${file}`);
      continue;
    }

    map.set(mod.data.name, mod);
  }
  return map;
}

/**
 * ✅ events 폴더의 이벤트 모듈을 로드해서 client에 등록
 * 이벤트 모듈 형식:
 * module.exports = { name: "ready", once: true, execute(client){...} }
 */
function registerEvents(client) {
  const eventsDir = path.join(__dirname, "events");
  const files = walkJsFiles(eventsDir);

  for (const file of files) {
    const event = require(file);

    // ✅ 이벤트 형식 검증
    if (!event?.name || typeof event.execute !== "function") {
      console.warn(`⚠️ 이벤트 형식 아님. 스킵: ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ✅ 1) 커맨드 로드
client.commands = loadCommandExecutors();

// ✅ 2) 이벤트 등록 (ready가 여기서 연결됨)
registerEvents(client);

// ✅ 3) interactionCreate 처리
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error(e);
    const msg = "처리 중 오류가 발생했습니다.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// ✅ 토큰 로그인
client.login(process.env.DISCORD_TOKEN);