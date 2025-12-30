require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

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

function loadLocalCommands() {
  const commandsDir = path.join(__dirname, "commands");
  const files = walkJsFiles(commandsDir);

  const list = [];
  const nameSet = new Set();

  for (const file of files) {
    const mod = require(file);

    if (!mod?.data?.name || typeof mod.execute !== "function") {
      throw new Error(`Invalid command module: ${file} (needs { data, execute })`);
    }

    const name = mod.data.name;
    if (nameSet.has(name)) throw new Error(`Duplicate command name: ${name}`);
    nameSet.add(name);

    list.push(mod.data.toJSON());
  }

  return list;
}

async function main() {
  const token = mustEnv("DISCORD_TOKEN");
  const clientId = mustEnv("CLIENT_ID");

  const scope = (process.env.DEPLOY_SCOPE || "guild").toLowerCase();
  const guildId = process.env.GUILD_ID;

  if (scope === "guild" && !guildId) {
    throw new Error("DEPLOY_SCOPE=guild requires GUILD_ID");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  const local = loadLocalCommands();

  // Discord 등록 대상 Route 선택
  const route =
    scope === "global"
      ? Routes.applicationCommands(clientId)
      : Routes.applicationGuildCommands(clientId, guildId);

  // ✅ “최상의 설계” 핵심:
  // PUT은 서버에 등록된 커맨드를 로컬 목록으로 '완전 동기화' 한다.
  // - 새 커맨드 추가
  // - 기존 커맨드 수정
  // - 로컬에서 삭제된 커맨드는 Discord에서도 삭제
  console.log(`Deploy scope: ${scope}${scope === "guild" ? ` (${guildId})` : ""}`);
  console.log(`Local commands: ${local.length}`);

  const result = await rest.put(route, { body: local });

  console.log(`Deployed commands: ${Array.isArray(result) ? result.length : "?"}`);
  console.log("✅ Done");
}

main().catch((err) => {
  console.error("❌ Deploy failed");
  console.error(err);
  process.exit(1);
});
