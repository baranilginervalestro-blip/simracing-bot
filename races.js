const fs = require('fs');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

const RACE_CARDS = './data/racecards.json';

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function writeJson(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

function isAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return config.adminRoleIds?.some(rid => interaction.member.roles.cache.has(rid));
}

async function applyTierRoles(member, count) {
  const { tier5, tier10, tier15 } = config.roles;

  // remove all tiers first
  const toRemove = [tier5, tier10, tier15].filter(Boolean);
  for (const rid of toRemove) {
    if (member.roles.cache.has(rid)) await member.roles.remove(rid).catch(() => {});
  }

  // add appropriate tier
  let add = null;
  if (count >= 15) add = tier15;
  else if (count >= 10) add = tier10;
  else if (count >= 5) add = tier5;

  if (add) await member.roles.add(add).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('races')
    .setDescription('Admin: set completed races for a driver')
    .addSubcommand(s =>
      s.setName('set')
        .setDescription('Set completed races count for a user')
        .addUserOption(o => o.setName('user').setDescription('Driver').setRequired(true))
        .addIntegerOption(o => o.setName('count').setDescription('Completed races').setRequired(true).setMinValue(0))
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'set') return;

    const user = interaction.options.getUser('user');
    const count = interaction.options.getInteger('count');

    const all = readJson(RACE_CARDS, {});
    if (!all[user.id]) {
      // create minimal profile if missing
      all[user.id] = { userId: user.id, racesCompleted: 0 };
    }
    all[user.id].racesCompleted = count;
    writeJson(RACE_CARDS, all);

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) await applyTierRoles(member, count);

    return interaction.reply(`✅ Set ${user.username}'s completed races to **${count}**. Roles updated.`);
  }
};
