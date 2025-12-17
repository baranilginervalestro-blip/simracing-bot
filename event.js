const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

const PATH = './data/events.json';

function loadEvents() {
  return JSON.parse(fs.readFileSync(PATH, 'utf8'));
}

function saveEvents(data) {
  fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Event yönetimi')

    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Yeni event ekle')
        .addStringOption(opt =>
          opt
            .setName('game')
            .setDescription('Oyun adı')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('event')
            .setDescription('Event adı')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Event sil')
        .addStringOption(opt =>
          opt
            .setName('game')
            .setDescription('Oyun adı')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('event')
            .setDescription('Event adı')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Eventleri listele')
    ),

  async execute(interaction) {
    const data = loadEvents();
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      if (Object.keys(data).length === 0) {
        return interaction.reply('📭 Kayıtlı event yok');
      }

      let text = '';
      for (const game in data) {
        text += `**${game}**\n`;
        for (const ev of data[game]) {
          text += `• ${ev}\n`;
        }
      }
      return interaction.reply(text);
    }

    const game = interaction.options.getString('game');
    const event = interaction.options.getString('event');

    if (sub === 'add') {
      if (!data[game]) data[game] = [];
      if (!data[game].includes(event)) {
        data[game].push(event);
        saveEvents(data);
      }
      return interaction.reply(`✅ **${game} → ${event}** eklendi`);
    }

    if (sub === 'remove') {
      if (!data[game]) {
        return interaction.reply('❌ Oyun bulunamadı');
      }
      data[game] = data[game].filter(e => e !== event);
      saveEvents(data);
      return interaction.reply(`🗑️ **${game} → ${event}** silindi`);
    }
  }
};
