const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, MessageFlags } = require("discord.js");

require("dotenv").config(); // ✅ .env 로드

const { migrate } = require("./db/migrate"); // ⚠️ migrate.js 위치에 맞게 수정
migrate(); // ✅ 서버 시작할 때 테이블 자동 생성

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

// ✅ 토큰 로그인
client.login(process.env.DISCORD_TOKEN);