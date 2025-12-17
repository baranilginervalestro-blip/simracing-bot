const fs = require('fs');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const config = require('../config.json');

const EVENTS = './data/events.json';
const RACE_CARDS = './data/racecards.json';

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
async function sendGameMenu(client, session) {
  const events = readJson(EVENTS, {});
  const channel = await client.channels.fetch(session.channelId).catch(() => null);
  if (!channel) return;

  const games = Object.keys(events);
  if (games.length === 0) return;

  const gameMenu = new StringSelectMenuBuilder()
    .setCustomId('rc_game')
    .setPlaceholder('Select Game')
    .addOptions(games.map(g => ({ label: g, value: g })));

  await channel.send({
    content: `<@${session.userId}> 🎮 Select your game:`,
    components: [new ActionRowBuilder().addComponents(gameMenu)]
  });
}

function writeJson(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

function ensureStores() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data');
  if (!fs.existsSync(EVENTS)) writeJson(EVENTS, {});
  if (!fs.existsSync(RACE_CARDS)) writeJson(RACE_CARDS, {});
}

function buildRaceCardEmbed(card) {
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
    .setName('racecard')
    .setDescription('Register your race card (English only)'),

  async execute(interaction) {
    ensureStores();

    // 5-field modal (Discord limit)
    const modal = new ModalBuilder()
      .setCustomId(`rc_modal_basic`)
      .setTitle('Race Card – Driver Info');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('fullname').setLabel('Full Name').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('steamid').setLabel('SteamID').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('simgrid').setLabel('SimGrid Account ID / Nick Name').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('class').setLabel('Your Class').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('nation').setLabel('Nation (optional)').setStyle(TextInputStyle.Short).setRequired(false)
      )
    );

    // Session store on client
    if (!interaction.client.rcSessions) interaction.client.rcSessions = new Map();
    interaction.client.rcSessions.delete(interaction.user.id);

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    ensureStores();
    if (!interaction.client.rcSessions) interaction.client.rcSessions = new Map();

    // Basic info modal submit
    if (interaction.customId === 'rc_modal_basic') {
      // ACK quickly to avoid "interaction failed"
      await interaction.deferReply({ ephemeral: true });

      const session = {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        fullName: interaction.fields.getTextInputValue('fullname'),
        steamID: interaction.fields.getTextInputValue('steamid'),
        simgrid: interaction.fields.getTextInputValue('simgrid'),
        class: interaction.fields.getTextInputValue('class'),
        nation: interaction.fields.getTextInputValue('nation') || '-',
        teamName: 'x',
        teamMate: 'x'
      };

      interaction.client.rcSessions.set(interaction.user.id, session);

      const addTeamBtn = new ButtonBuilder()
        .setCustomId('rc_add_team')
        .setLabel('Add Team Info (optional)')
        .setStyle(ButtonStyle.Secondary);

      const skipBtn = new ButtonBuilder()
        .setCustomId('rc_skip_team')
        .setLabel('Continue')
        .setStyle(ButtonStyle.Primary);

      await interaction.editReply({
        content: 'Driver info saved. If you have a team, add it now. Otherwise press **Continue**.',
        components: [new ActionRowBuilder().addComponents(addTeamBtn, skipBtn)]
      });

      return;
    }

    // Team modal submit
    if (interaction.customId === 'rc_modal_team') {
      await interaction.deferReply({ ephemeral: true });

      const session = interaction.client.rcSessions?.get(interaction.user.id);
      if (!session) return interaction.editReply('Session expired. Please run /racecard again.');

      session.teamName = interaction.fields.getTextInputValue('teamname') || 'x';
      session.teamMate = interaction.fields.getTextInputValue('teammate') || 'x';

      await interaction.editReply('Team info saved. Now select your game in the channel.');

      // Send game menu in the original channel
      await sendGameMenu(interaction.client, session);


      return;
    }
  },

  async handleComponent(interaction) {
    ensureStores();
    const sessions = interaction.client.rcSessions;
    const session = sessions?.get(interaction.user.id);

    // Button: open team modal
    if (interaction.isButton() && interaction.customId === 'rc_add_team') {
      if (!session) return interaction.reply({ content: 'Session expired. Run /racecard again.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId('rc_modal_team')
        .setTitle('Race Card – Team Info');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('teamname').setLabel('Team Name (optional)').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('teammate').setLabel("Team Mate's Name (If you have)").setStyle(TextInputStyle.Short).setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }

    // Button: skip team and continue
    if (interaction.isButton() && interaction.customId === 'rc_skip_team') {
      if (!session) return interaction.reply({ content: 'Session expired. Run /racecard again.', ephemeral: true });
      await interaction.deferUpdate(); // ACK button
      await sendGameMenu(interaction.client, session);

      return;
    }

    // Select: Game
    if (interaction.isStringSelectMenu() && interaction.customId === 'rc_game') {
      if (!session) return interaction.reply({ content: 'Session expired. Run /racecard again.', ephemeral: true });

      await interaction.deferUpdate(); // ACK fast

      const events = readJson(EVENTS, {});
      session.game = interaction.values[0];

      const eventList = events[session.game] || [];
      const eventMenu = new StringSelectMenuBuilder()
        .setCustomId('rc_event')
        .setPlaceholder('Select Event')
        .addOptions(eventList.map(e => ({ label: e, value: e })));

      await interaction.message.edit({
        content: '🏁 Select your event:',
        components: [new ActionRowBuilder().addComponents(eventMenu)]
      });

      return;
    }

    // Select: Event (finalize)
    if (interaction.isStringSelectMenu() && interaction.customId === 'rc_event') {
      if (!session) {
        return interaction.reply({ content: 'Session expired. Run /racecard again.', ephemeral: true });
      }

      await interaction.deferUpdate(); // ACK fast

      session.event = interaction.values[0];

      const all = readJson(RACE_CARDS, {});
      if (!all[session.userId]) {
        all[session.userId] = {
          profile: {
            userId: session.userId,
            fullName: session.fullName,
            steamID: session.steamID,
            simgrid: session.simgrid,
            nation: session.nation
          },
          registrations: {}
        };
      }

      const userData = all[session.userId];
      const key = `${session.game}|${session.event}`;
      // ✅ ensure registrations exists
      if (!userData.registrations) {
        userData.registrations = {};
      }

      // ❌ SAME EVENT CHECK
      if (userData.registrations[key]) {
        await interaction.message.edit({
          content: '❌ You are already registered for this event.',
          components: []
        });
        return;
      }

      // SAVE REGISTRATION
      userData.registrations[key] = {
        game: session.game,
        event: session.event,
        class: session.class,
        teamName: session.teamName,
        teamMate: session.teamMate,
        carNumber: null,
        racesCompleted: 0,
        dmMessageId: null,
        logMessageId: null
      };
      if (interaction.isStringSelectMenu() && interaction.customId === 'rc_event') {

        await interaction.deferUpdate();

        session.event = interaction.values[0];

        // 1️⃣ JSON OKU
        const all = readJson(RACE_CARDS, {});

        // 2️⃣ EXTRA SAFETY – ensure user root exists
        if (!all[session.userId]) {
          all[session.userId] = {
            profile: {
              userId: session.userId,
              fullName: session.fullName,
              steamID: session.steamID,
              simgrid: session.simgrid,
              nation: session.nation
            },
            registrations: {}
          };
        }

        const userData = all[session.userId];

        // 3️⃣ EXTRA SAFETY – ensure registrations exists
        if (!userData.registrations) {
          userData.registrations = {};
        }

        const key = `${session.game}|${session.event}`;

        // 4️⃣ SAME EVENT CHECK
        if (userData.registrations[key]) {
          await interaction.message.edit({
            content: '❌ You are already registered for this event.',
            components: []
          });
          return;
        }

        // 5️⃣ SAVE REGISTRATION
        userData.registrations[key] = {
          game: session.game,
          event: session.event,
          class: session.class,
          teamName: session.teamName,
          teamMate: session.teamMate,
          carNumber: null,
          racesCompleted: 0,
          dmMessageId: null,
          logMessageId: null
        };

        writeJson(RACE_CARDS, all);

        const embed = buildRaceCardEmbed({
          userId: session.userId,
          ...session
        });

        // 6️⃣ UPDATE CHANNEL MESSAGE
        await interaction.message.edit({
          content: '✅ Registration complete. **Car number is assigned by admins.**',
          components: [],
          embeds: [embed]
        });

        // 7️⃣ DM USER
        try {
          const dmMsg = await interaction.user.send({
            content: '✅ Your registration is complete. Car number is assigned by admins.',
            embeds: [embed]
          });
          userData.registrations[key].dmMessageId = dmMsg.id;
        } catch {}

        // 8️⃣ LOG CHANNEL
        const guild = interaction.guild;
        const log = guild.channels.cache.find(c => c.name === config.racecardLogChannelName);
        if (log) {
          const logMsg = await log.send({ embeds: [embed] });
          userData.registrations[key].logMessageId = logMsg.id;
        }

        writeJson(RACE_CARDS, all);

        interaction.client.rcSessions.delete(session.userId);
        return;
      }
    }
  },
};
