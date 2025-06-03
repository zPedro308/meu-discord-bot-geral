// Bot de bate-ponto semi-automático para Discord
// Desenvolvido para uso com Node.js no Replit, Railway e GitHub

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, SlashCommandBuilder, Collection } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const token = process.env.DISCORD_TOKEN;
const painelCargoID = '1379499095680483398';
const canaisPermitidos = [
  '1379498982170038272',
  '1379498992848863232',
  '1379498997752008754',
  '1379499002411618314',
  '1379499014868701224'
];
const canalAlerta = '1379528281195544709';
const canalLogsPonto = '1379526876326002779';
const canalLogsGerais = '1379498878235181127';
const canalRelatorioReset = '1379531018591277076';

let pontos = {};
try {
  if (fs.existsSync('data.json')) pontos = JSON.parse(fs.readFileSync('data.json'));
} catch (e) {
  console.error("Erro ao carregar data.json:", e);
  pontos = {};
}

const usersAusentes = new Map();

client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'painelhoras') {
      if (!interaction.member.roles.cache.has(painelCargoID)) {
        return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(':InfoBlue: Esse servidor possuí sistema de BATE-PONTO SEMI - AUTOMATICO')
        .setDescription(`Uma maneira fácil, prática e rápida de registrar pontos.

**COMO UTILIZAR:**

> Para abrir um ponto você precisa entrar em uma das categorias permitidas para abertura e clicar no botão __ABRIR__.
> Após estar com ponto aberto e não quiser mais fazer ações você pode fechar seu ponto clicando no botão __FECHAR__.
> Você pode também consultar o total de horas obtidas em todos os pontos da semana, clicando no botão __HORAS__.

:Alerta: O sistema conta com o fechamento automático de pontos, caso sua internet cair ou esquecer de fechar e sair da call, não se preocupe seu ponto será fechado automaticamente.`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('abrir_ponto').setLabel('ABRIR').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('fechar_ponto').setLabel('FECHAR').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('horas').setLabel('HORAS').setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'resethoras') {
      const relatorio = Object.entries(pontos).map(([id, data]) => `<@${id}> fez **${((data.total || 0) / 3600000).toFixed(2)}** horas`).join('\n') || 'Nenhum dado encontrado.';
      pontos = {};
      fs.writeFileSync('data.json', JSON.stringify(pontos));
      const canal = client.channels.cache.get(canalRelatorioReset);
      if (canal) canal.send({ content: '**Relatório de reset de horas:**\n' + relatorio });
      else console.error("Canal de relatório não encontrado.");
    }
  }

  if (interaction.isButton()) {
    const userId = interaction.user.id;
    const agora = Date.now();

    if (interaction.customId === 'abrir_ponto') {
      if (!interaction.member.voice.channel || !canaisPermitidos.includes(interaction.member.voice.channelId)) {
        return interaction.reply({ content: 'Você precisa estar em um canal de voz autorizado para abrir o ponto.', ephemeral: true });
      }

      pontos[userId] = { ...pontos[userId], inicio: agora };
      fs.writeFileSync('data.json', JSON.stringify(pontos));
      const canalVoz = interaction.member.voice.channel;
      const embedAbrir = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Ponto Aberto')
        .setDescription(`<@${userId}> abriu o ponto às <t:${Math.floor(agora / 1000)}:t> no canal **${canalVoz.name}**.`);

      client.channels.cache.get(canalLogsGerais)?.send({ embeds: [embedAbrir] });
      return interaction.reply({ content: 'Ponto aberto com sucesso!', ephemeral: true });
    }

    if (interaction.customId === 'fechar_ponto') {
      const inicio = pontos[userId]?.inicio;
      if (!inicio) return interaction.reply({ content: 'Você não tem um ponto aberto.', ephemeral: true });

      const tempo = agora - inicio;
      pontos[userId].total = (pontos[userId].total || 0) + tempo;
      delete pontos[userId].inicio;
      fs.writeFileSync('data.json', JSON.stringify(pontos));

      const canalVoz = interaction.member.voice.channel;
      const nomeCanal = canalVoz ? canalVoz.name : 'Desconhecido';

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Ponto Fechado')
        .setDescription(
          `<@${userId}> fechou o ponto no canal **${nomeCanal}**.\n` +
          `🕒 Tempo da patrulha: **${(tempo / 60000).toFixed(0)} min**\n` +
          `📊 Total semanal: **${((pontos[userId].total || 0) / 3600000).toFixed(2)} horas**`
        );

      client.channels.cache.get(canalLogsPonto)?.send({ embeds: [embed] });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.customId === 'horas') {
      const total = pontos[userId]?.total || 0;
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Minhas Horas')
        .setDescription(`<@${userId}>, você tem um total de **${(total / 3600000).toFixed(2)}** horas esta semana.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = oldState.id;

  if (pontos[userId]?.inicio && !newState.channelId && canaisPermitidos.includes(oldState.channelId)) {
    client.channels.cache.get(canalAlerta)?.send(`<@${userId}> saiu da call com ponto aberto! Tem 2 minutos para voltar.`);

    const timeout = setTimeout(async () => {
      const membro = await newState.guild.members.fetch(userId).catch(() => null);
      if (!membro?.voice?.channelId) {
        const agora = Date.now();
        const tempo = agora - pontos[userId].inicio;
        pontos[userId].total = (pontos[userId].total || 0) + tempo;
        delete pontos[userId].inicio;
        fs.writeFileSync('data.json', JSON.stringify(pontos));

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Ponto Fechado Automaticamente')
          .setDescription(`<@${userId}> teve o ponto fechado automaticamente.\n⏱️ Tempo da patrulha: **${(tempo / 60000).toFixed(0)} min**\n⏳ Total semanal: **${((pontos[userId].total || 0) / 3600000).toFixed(2)} horas**`);

        client.channels.cache.get(canalLogsPonto)?.send({ embeds: [embed] });
      }
      usersAusentes.delete(userId);
    }, 120000);

    usersAusentes.set(userId, timeout);
  }

  if (newState.channelId && usersAusentes.has(userId)) {
    clearTimeout(usersAusentes.get(userId));
    usersAusentes.delete(userId);
    client.channels.cache.get(canalAlerta)?.send(`<@${userId}> voltou para a call a tempo. Ponto continua ativo.`);
  }
});

client.commands = new Collection();
client.on('ready', async () => {
  const data = [
    new SlashCommandBuilder().setName('painelhoras').setDescription('Exibe o painel de ponto'),
    new SlashCommandBuilder().setName('resethoras').setDescription('Reseta horas de todos e mostra relatório')
  ];
  await client.application.commands.set(data);
});

client.login(token);
