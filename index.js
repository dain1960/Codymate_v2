const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");

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
    map.set(mod.data.name, mod);
  }
  return map;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = loadCommandExecutors();

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

client.login(process.env.DISCORD_TOKEN);
