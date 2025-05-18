// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const { QuickDB } = require('quick.db');

const db = new QuickDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// --- CONFIGURAÇÕES ---
const IDS = {
  CARGO_ADMIN: '1369351249022947468',

  CARGO_VIATURA: '1369352042031616121',
  CARGO_AUSENCIA: '1369352010792571001',
  CARGO_GERAL: '1369352000277319740',

  CANAL_LOGS_GERAL: '1369350793181925428',

  CANAL_LOGS_VIATURA: '1369350949230874834',
  CANAL_LOGS_AUSENCIA: '1369350960220082328',

  CANAL_PAINEL_HORAS: '1369350872718508062',
  CANAL_ALERTA_SAIDA_VOZ: '1369350878041215017',
  CANAL_LOGS_PONTO: '1369350983921958993',

  CANAIS_VOZ_PODEM_ABRIR_PONTO: new Set([
    '1369350549077491783','1369350561178193991','1369350573408911390','1369350581826879658',
    '1369350598142460034','1369350601065889822','1369350614638919801','1369350619298664540',
    '1369350627561574580','1369350635891327136','1369350641306046504','1369350646720893019',
    '1369350652777599147','1369350663150239874','1369350667466178610','1369350672864252106',
    '1369350685841293462','1369350696410812557','1369350700789928117','1369350708641534022',
    '1369350712856936621','1369350719194271937','1369350730280079422','1369350735027769444',
    '1369350737150218312','1369350749842047147','1369350764983488632','1369350767139491921',
    '1369350773137477763','1369350783325306970'
  ]),
};

// --- Função para checar permissão do cargo admin ---
function isAdmin(member) {
  return member.roles.cache.has(IDS.CARGO_ADMIN);
}

// --- Montagem dos painéis ---
function painelViatura() {
  const embed = new EmbedBuilder()
    .setTitle('Solicitação de Viatura')
    .setDescription(`Clique no botão abaixo para solicitar uma viatura.\n\n**<@&${IDS.CARGO_VIATURA}> será notificado.**`)
    .setColor('#3498db')
    .setFooter({ text: 'PMESP | Sistema de Viaturas' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('solicitar_viatura')
      .setLabel('Solicitar Viatura')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function painelAusencia() {
  const embed = new EmbedBuilder()
    .setTitle('Solicitação de Ausência')
    .setDescription(`Clique no botão abaixo para solicitar ausência.\n\n**<@&${IDS.CARGO_AUSENCIA}> será notificado.**`)
    .setColor('#e67e22')
    .setFooter({ text: 'PMESP | Sistema de Ausências' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('solicitar_ausencia')
      .setLabel('Solicitar Ausência')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

function painelPonto() {
  const embed = new EmbedBuilder()
    .setTitle('Painel de Controle de Ponto')
    .setDescription('Aqui você pode abrir seu ponto, fechar ou consultar suas horas trabalhadas.')
    .setColor('#2ecc71')
    .setFooter({ text: 'PMESP | Sistema de Ponto' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_ponto')
      .setLabel('Abrir Ponto')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('fechar_ponto')
      .setLabel('Fechar Ponto')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('minhas_horas')
      .setLabel('Minhas Horas')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// --- Botões para aceitar e negar solicitações ---
function rowAceitarNegar(type) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${type}_aceitar`)
      .setLabel('Aceitar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${type}_negar`)
      .setLabel('Negar')
      .setStyle(ButtonStyle.Danger)
  );
}

// --- Registro de comando slash na guild (pode ser global, mas por guild garante mais rápido) ---
client.on(Events.ClientReady, async () => {
  console.log(`Bot online como ${client.user.tag}`);

  const data = new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Gerar painel de viatura, ausência ou ponto')
    .addStringOption(option =>
      option.setName('modalidade')
        .setDescription('Qual painel deseja gerar?')
        .setRequired(true)
        .addChoices(
          { name: 'Viatura', value: 'viatura' },
          { name: 'Ausência', value: 'ausencia' },
          { name: 'Ponto', value: 'ponto' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

  // Registrar em todas as guilds cacheadas
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.create(data);
  }
});

// --- Interação de comando ---
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'painel') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
      }

      const modalidade = interaction.options.getString('modalidade');
      let painelData;

      switch (modalidade) {
        case 'viatura':
          painelData = painelViatura();
          break;
        case 'ausencia':
          painelData = painelAusencia();
          break;
        case 'ponto':
          painelData = painelPonto();
          break;
        default:
          return interaction.reply({ content: 'Modalidade inválida.', ephemeral: true });
      }

      return interaction.reply({ ...painelData, ephemeral: false });
    }
  }
});

// --- Interação de botões ---
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const { customId, member, guild, channel } = interaction;

  // --- Solicitar Viatura ---
  if (customId === 'solicitar_viatura') {
    await interaction.reply({
      content: `Por favor, envie sua solicitação de viatura no canal <#${IDS.CANAL_LOGS_VIATURA}> ou aguarde que a equipe responsável entrará em contato.`,
      ephemeral: true,
    });

    const canalViatura = guild.channels.cache.get(IDS.CANAL_LOGS_VIATURA);
    if (canalViatura) {
      const embed = new EmbedBuilder()
        .setTitle('Nova Solicitação de Viatura')
        .setDescription(`O usuário <@${member.id}> solicitou uma viatura.`)
        .setColor('#3498db')
        .setTimestamp();

      const row = rowAceitarNegar('viatura');

      canalViatura.send({ content: `<@&${IDS.CARGO_VIATURA}>`, embeds: [embed], components: [row] });
    }
    return;
  }

  // --- Solicitar Ausência ---
  if (customId === 'solicitar_ausencia') {
    // Abrir modal para motivo e data retorno
    const modal = new ModalBuilder()
      .setCustomId('modal_ausencia')
      .setTitle('Solicitação de Ausência');

    const motivoInput = new TextInputBuilder()
      .setCustomId('motivo')
      .setLabel('Motivo da ausência')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(400);

    const retornoInput = new TextInputBuilder()
      .setCustomId('data_retorno')
      .setLabel('Data prevista de retorno')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    // Modal permite apenas 5 inputs por vez, usar ActionRow para cada
    const firstRow = new ActionRowBuilder().addComponents(motivoInput);
    const secondRow = new ActionRowBuilder().addComponents(retornoInput);

    modal.addComponents(firstRow, secondRow);

    await interaction.showModal(modal);
    return;
  }

  // --- Aceitar ou Negar Solicitação de Viatura ---
  if (customId === 'viatura_aceitar' || customId === 'viatura_negar') {
    if (!member.roles.cache.has(IDS.CARGO_ADMIN)) {
      return interaction.reply({ content: '❌ Você não tem permissão para aceitar ou negar solicitações.', ephemeral: true });
    }

    const mensagem = interaction.message;
    const solicitanteMention = mensagem.embeds[0]?.description?.match(/<@!?(\d+)>/);
    const solicitanteId = solicitanteMention ? solicitanteMention[1] : null;
    const solicitante = solicitanteId ? await guild.members.fetch(solicitanteId).catch(() => null) : null;

    if (customId === 'viatura_aceitar') {
      if (solicitante) {
        await solicitante.roles.add(IDS.CARGO_VIATURA);
      }
      await interaction.reply({ content: `Solicitação de viatura aceita pelo ${member}.`, ephemeral: false });
    } else {
      await interaction.reply({ content: `Solicitação de viatura negada pelo ${member}.`, ephemeral: false });
    }

    setTimeout(() => {
      mensagem.delete().catch(() => {});
    }, 60 * 1000);

    return;
  }

  // --- Aceitar ou Negar Solicitação de Ausência ---
  if (customId === 'ausencia_aceitar' || customId === 'ausencia_negar') {
    if (!member.roles.cache.has(IDS.CARGO_ADMIN)) {
      return interaction.reply({ content: '❌ Você não tem permissão para aceitar ou negar solicitações.', ephemeral: true });
    }

    const mensagem = interaction.message;
    const solicitanteMention = mensagem.embeds[0]?.description?.match(/<@!?(\d+)>/);
    const solicitanteId = solicitanteMention ? solicitanteMention[1] : null;
    const solicitante = solicitanteId ? await guild.members.fetch(solicitanteId).catch(() => null) : null;

    if (customId === 'ausencia_aceitar') {
      if (solicitante) {
        await solicitante.roles.add(IDS.CARGO_AUSENCIA);
      }
      await interaction.reply({ content: `Solicitação de ausência aceita pelo ${member}.`, ephemeral: false });
    } else {
      await interaction.reply({ content: `Solicitação de ausência negada pelo ${member}.`, ephemeral: false });
    }

    setTimeout(() => {
      mensagem.delete().catch(() => {});
    }, 60 * 1000);

    return;
  }

  // --- Bate Ponto: abrir, fechar e consultar ---
  if (customId === 'abrir_ponto') {
    if (!IDS.CANAIS_VOZ_PODEM_ABRIR_PONTO.has(member.voice.channelId)) {
      return interaction.reply({ content: '❌ Você precisa estar em um canal de voz permitido para abrir ponto.', ephemeral: true });
    }

    const jaAberto = await db.get(`ponto_ativo_${member.id}`);
    if (jaAberto) {
      return interaction.reply({ content: '❌ Você já abriu ponto anteriormente sem fechar.', ephemeral: true });
    }

    await db.set(`ponto_ativo_${member.id}`, Date.now());

    await interaction.reply({ content: '✅ Ponto aberto com sucesso!', ephemeral: true });

    const canalLogs = guild.channels.cache.get(IDS.CANAL_LOGS_PONTO);
    if (canalLogs) {
      canalLogs.send({
        content: `🟢 <@${member.id}> abriu ponto às <t:${Math.floor(Date.now()/1000)}:T>.`
      });
    }
    return;
  }

  if (customId === 'fechar_ponto') {
    const aberto = await db.get(`ponto_ativo_${member.id}`);
    if (!aberto) {
      return interaction.reply({ content: '❌ Você não possui ponto aberto.', ephemeral: true });
    }

    const duracao = Date.now() - aberto;
    const horas = Math.floor(duracao / (1000 * 60 * 60));
    const minutos = Math.floor((duracao % (1000 * 60 * 60)) / (1000 * 60));

    // Somar as horas já registradas do usuário
    let totalHoras = await db.get(`total_horas_${member.id}`) || 0;
    totalHoras += duracao;
    await db.set(`total_horas_${member.id}`, totalHoras);

    await db.delete(`ponto_ativo_${member.id}`);

    await interaction.reply({ content: `⏹️ Ponto fechado! Você trabalhou ${horas}h ${minutos}m nesse período.`, ephemeral: true });

    const canalLogs = guild.channels.cache.get(IDS.CANAL_LOGS_PONTO);
    if (canalLogs) {
      canalLogs.send({
        content: `🔴 <@${member.id}> fechou ponto às <t:${Math.floor(Date.now()/1000)}:T> após trabalhar ${horas}h ${minutos}m.`
      });
    }
    return;
  }

  if (customId === 'minhas_horas') {
    let totalHoras = await db.get(`total_horas_${member.id}`) || 0;

    // Converter total de ms para h e m
    const horas = Math.floor(totalHoras / (1000 * 60 * 60));
    const minutos = Math.floor((totalHoras % (1000 * 60 * 60)) / (1000 * 60));

    await interaction.reply({ content: `⏱️ Você acumulou **${horas}h ${minutos}m** de trabalho registrado.`, ephemeral: true });
    return;
  }
});

// --- Modal Submit ---
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'modal_ausencia') {
    const motivo = interaction.fields.getTextInputValue('motivo');
    const data_retorno = interaction.fields.getTextInputValue('data_retorno');
    const membro = interaction.member;
    const guild = interaction.guild;

    // Salvar ausência no banco de dados com timestamp e info
    await db.set(`ausencia_${membro.id}`, { motivo, data_retorno, timestamp: Date.now() });

    // Enviar embed para canal de logs de ausência
    const canalAusencia = guild.channels.cache.get(IDS.CANAL_LOGS_AUSENCIA);
    if (canalAusencia) {
      const embed = new EmbedBuilder()
        .setTitle('Nova Solicitação de Ausência')
        .setDescription(`Usuário: <@${membro.id}>\nMotivo: ${motivo}\nData de retorno: ${data_retorno}`)
        .setColor('#e67e22')
        .setTimestamp();

      const row = rowAceitarNegar('ausencia');

      await canalAusencia.send({ content: `<@&${IDS.CARGO_AUSENCIA}>`, embeds: [embed], components: [row] });
    }

    await interaction.reply({ content: 'Sua solicitação de ausência foi enviada para análise.', ephemeral: true });
  }
});

// --- Express + BetterStack para manter bot online no Replit ---
const app = express();

app.get('/', (req, res) => {
  res.send('Bot PMESP está online!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
});

// --- Login do bot ---
client.login(process.env.TOKEN);
