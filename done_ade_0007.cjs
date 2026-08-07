const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  // ADE-0007-0001: Bot Discord
  {
    taskCode: 'ADE-0007-0001-001',
    fecha: '2026-08-07T12:01:00Z',
    resultado: 'discord.py 2.7.1 instalado en VPS. SageDiscordBot implementado como subclase de commands.Bot con intents: message_content (privilegiado — requiere activar en Developer Portal), messages, guilds. Configuración: DISCORD_BOT_TOKEN y DISCORD_GUILD_ID como variables de entorno. setup_hook() sincroniza slash commands al guild en <1s (vs. 1h global sync). Prerequisito documentado: crear app en discord.com/developers/applications.',
  },
  {
    taskCode: 'ADE-0007-0001-002',
    fecha: '2026-08-07T12:02:00Z',
    resultado: 'on_message() implementado: filtra mensajes propios, detecta si el canal está en CHANNEL_ROUTING o si hay mención directa de agente en el texto. Solo procesa mensajes relevantes (no todos los mensajes del servidor). Usa async with channel.typing() para mostrar indicador de escritura mientras el agente procesa. Test: todos los canales sage-* enrutan correctamente al agente configurado.',
  },
  {
    taskCode: 'ADE-0007-0001-003',
    fecha: '2026-08-07T12:03:00Z',
    resultado: 'Respuesta del bot implementada: _dispatch_to_agent() llama a invoke_claude() via loop.run_in_executor() (no bloquea el event loop de Discord). System prompt por agente incluye nombre, rol y personalidad. Respuesta formateada con format_response() incluye emoji + nombre + rol del agente. _split_message() divide respuestas largas en chunks de 1990 chars para respetar límite Discord.',
  },
  {
    taskCode: 'ADE-0007-0001-004',
    fecha: '2026-08-07T12:05:00Z',
    resultado: 'Slash commands implementados: /tarea (agente, prompt, prioridad) encola Task en Harness con TaskPriority configurable y confirma en Discord con task_id[:8]; /estado muestra backend y tareas pendientes del Harness. Registrados como app_commands.command en bot.tree. Test: bot.tree.get_commands() retorna ["tarea", "estado"]. Requiere que el bot tenga scope applications.commands en la invitación.',
  },
  {
    taskCode: 'ADE-0007-0001-005',
    fecha: '2026-08-07T12:06:00Z',
    resultado: 'Test de flujo Discord → agente → respuesta: 5 tests estructurales pasados sin token real. Routing correcto para 6 casos (canales sage-* y desconocido). Menciones @Ares, atlas, Iris detectadas correctamente. Formato con identidad del agente verificado. Los 9 canales configurados alcanzan los 5 agentes (ares, atlas, iris, orion, vesta). Slash commands registrados. Con DISCORD_BOT_TOKEN el bot se inicia via bot.run(token).',
  },

  // ADE-0007-0002: Router + identidades
  {
    taskCode: 'ADE-0007-0002-001',
    fecha: '2026-08-07T12:07:00Z',
    resultado: 'CHANNEL_ROUTING implementado como dict: sage-ares→ares, sage-atlas→atlas, sage-iris→iris, sage-orion→orion, sage-vesta→vesta, sage-general→orion, sage-dev→atlas, sage-finance→vesta, sage-sales→ares. 9 canales → 5 agentes. Extensible: agregar entradas al dict para nuevos canales sin modificar la lógica del router.',
  },
  {
    taskCode: 'ADE-0007-0002-002',
    fecha: '2026-08-07T12:07:00Z',
    resultado: 'SageRouter.route() implementado: prioridad 1 → _detect_mention (mención directa en texto), prioridad 2 → CHANNEL_ROUTING por nombre de canal, prioridad 3 → fallback a "orion". Test exhaustivo: 6 casos de routing correctos incluyendo canal desconocido → Orion. Router puro (sin dependencias de Discord) — testeable sin bot activo.',
  },
  {
    taskCode: 'ADE-0007-0002-003',
    fecha: '2026-08-07T12:08:00Z',
    resultado: '_detect_mention() implementado: busca alias de cada agente en el contenido del mensaje (case-insensitive). Cada agente tiene mention_alias: ["@ares", "@Ares", "ares"]. Test: "@Ares revisa el sprint" → ares, "que piensa atlas sobre esto" → atlas, "Iris ¿cómo mejorarías?" → iris, "mensaje sin mención" → None. Prioridad máxima: supera el routing por canal.',
  },
  {
    taskCode: 'ADE-0007-0002-004',
    fecha: '2026-08-07T12:09:00Z',
    resultado: 'AGENT_IDENTITIES y format_response() implementados: cada agente tiene nombre, emoji, rol y personalidad. format_response(agent_slug, text) genera cabecera "⚔️ **Ares** · _Operaciones & CRM_" antes de la respuesta. System prompt en _dispatch_to_agent() inyecta nombre+rol+personalidad+canal+autor al prompt de Claude Code. Respuestas con identidad diferenciada por agente, no bot genérico.',
  },
  {
    taskCode: 'ADE-0007-0002-005',
    fecha: '2026-08-07T12:10:00Z',
    resultado: 'Test routing multiagente: 9 canales configurados → 5 agentes alcanzables {ares, atlas, iris, orion, vesta}. Routing correcto para sage-sales→ares, sage-finance→vesta, sage-dev→atlas, sage-general→orion. Menciones directas superan el routing por canal en todos los casos. Slash commands [tarea, estado] registrados y verificados. Commit 386a322 pusheado. Prerequisito final: DISCORD_BOT_TOKEN + activar Message Content Intent en Developer Portal.',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { status: 'DONE', resultado: item.resultado, fechaEjecucion: new Date(item.fecha) },
    });
    console.log('✓ ' + item.taskCode + ' → ' + item.fecha.slice(11, 16));
  }

  // ADE-0007-0003 está vacío — marcar directamente como DONE
  for (const code of ['ADE-0007-0001', 'ADE-0007-0002', 'ADE-0007-0003']) {
    await p.sprint.update({ where: { sprintCode: code }, data: { status: 'DONE' } });
    console.log('✓ Sprint ' + code + ' → DONE');
  }

  await p.$disconnect();
}

run();
