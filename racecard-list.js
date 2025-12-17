const fs = require('fs');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const RACE_CARDS = './data/racecards.json';

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('racecard-list')
    .setDescription('List your registered events'),

  async execute(interaction) {
    const all = readJson(RACE_CARDS, {});
    const userData = all[interaction.user.id];

    if (!userData || !userData.registrations || Object.keys(userData.registrations).length === 0) {
      return interaction.reply({
        content: '❌ You are not registered for any events.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🏁 Your Event Registrations');

    for (const key of Object.keys(userData.registrations)) {
      const reg = userData.registrations[key];
      embed.addFields({
        name: `${reg.game} – ${reg.event}`,
        value:
          `Class: **${reg.class}**\n` +
          `Team: **${reg.teamName || 'x'}**\n` +
          `Team Mate: **${reg.teamMate || 'x'}**\n` +
          `Races Completed: **${reg.racesCompleted}**`,
        inline: false
      });
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
