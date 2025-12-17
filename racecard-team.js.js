const fs = require('fs');
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
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

function buildEmbed(card) {
  return new EmbedBuilder()
    .setTitle('🏁 Race Card Registration')
    .addFields(
      { name: 'User', value: `<@${card.userId}>`, inline: true },
      { name: 'Full Name', value: card.fullName, inline: true },
      { name: 'SteamID', value: card.steamID, inline: true },
      { name: 'SimGrid', value: card.simgrid, inline: true },
      { name: 'Class', value: card.class, inline: true },
      { name: 'Nation', value: card.nation || '-', inline: true },
      { name: 'Team Name', value: card.teamName || 'x', inline: true },
      { name: 'Team Mate', value: card.teamMate || 'x', inline: true },
      { name: 'Game', value: card.game || '-', inline: true },
      { name: 'Event', value: card.event || '-', inline: true },
      { name: 'Car Number', value: 'Assigned by admins', inline: true }
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('racecard-team')
    .setDescription('Update your team information'),

  async execute(interaction) {
    const all = readJson(RACE_CARDS, {});
    const card = all[interaction.user.id];

    if (!card) {
      return interaction.reply({ content: '❌ You do not have a race card yet.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('rc_team_update')
      .setTitle('Update Team Info');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('teamname')
          .setLabel('Team Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(card.teamName || 'x')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('teammate')
          .setLabel("Team Mate's Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(card.teamMate || 'x')
      )
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (interaction.customId !== 'rc_team_update') return;

    await interaction.deferReply({ ephemeral: true });

    const all = readJson(RACE_CARDS, {});
    const card = all[interaction.user.id];
    if (!card) {
      return interaction.editReply('❌ Race card not found.');
    }

    card.teamName = interaction.fields.getTextInputValue('teamname') || 'x';
    card.teamMate = interaction.fields.getTextInputValue('teammate') || 'x';
    writeJson(RACE_CARDS, all);

    const embed = buildEmbed(card);

    // Update DM embed
    if (card.dmMessageId) {
      try {
        const dm = await interaction.user.createDM();
        const msg = await dm.messages.fetch(card.dmMessageId);
        await msg.edit({ embeds: [embed] });
      } catch {}
    }

    // Update log embed
    const guild = interaction.guild;
    const log = guild.channels.cache.find(c => c.name === config.racecardLogChannelName);
    if (log && card.logMessageId) {
      try {
        const msg = await log.messages.fetch(card.logMessageId);
        await msg.edit({ embeds: [embed] });
      } catch {}
    }

    await interaction.editReply('✅ Team information updated successfully.');
  }
};
