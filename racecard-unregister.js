const fs = require('fs');
const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder
} = require('discord.js');

const config = require('../config.json');
const RACE_CARDS = './data/racecards.json';

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function writeJson(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('racecard-unregister')
    .setDescription('Unregister from an event'),

  async execute(interaction) {
    const all = readJson(RACE_CARDS, {});
    const userData = all[interaction.user.id];

    if (!userData || !userData.registrations || Object.keys(userData.registrations).length === 0) {
      return interaction.reply({
        content: '❌ You have no event registrations.',
        ephemeral: true
      });
    }

    const options = Object.keys(userData.registrations).map(key => {
      const r = userData.registrations[key];
      return {
        label: `${r.game} – ${r.event}`,
        value: key
      };
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('racecard_unregister_select')
      .setPlaceholder('Select event to unregister')
      .addOptions(options);

    await interaction.reply({
      content: 'Select the event you want to unregister from:',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'racecard_unregister_select') return;

    await interaction.deferUpdate();

    const key = interaction.values[0];
    const all = readJson(RACE_CARDS, {});
    const userData = all[interaction.user.id];

    if (!userData || !userData.registrations || !userData.registrations[key]) {
      return;
    }

    const reg = userData.registrations[key];

    // 🔥 DELETE DM MESSAGE
    if (reg.dmMessageId) {
      try {
        const dm = await interaction.user.createDM();
        const msg = await dm.messages.fetch(reg.dmMessageId);
        await msg.delete();
      } catch {}
    }

    // 🔥 DELETE LOG MESSAGE
    const guild = interaction.guild;
    const log = guild.channels.cache.find(c => c.name === config.racecardLogChannelName);
    if (log && reg.logMessageId) {
      try {
        const msg = await log.messages.fetch(reg.logMessageId);
        await msg.delete();
      } catch {}
    }

    // 🔥 REMOVE REGISTRATION
    delete userData.registrations[key];
    writeJson(RACE_CARDS, all);

    await interaction.editReply({
      content: '✅ You have been successfully unregistered from the event.',
      components: []
    });
  }
};
