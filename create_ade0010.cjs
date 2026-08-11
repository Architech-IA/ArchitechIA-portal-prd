const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Obtener solución ADE y agente Orion
  const solucion = await p.solucion.findFirst({ where: { nombre: { contains: 'Dev Engine' } } });
  if (!solucion) { console.log('Solución no encontrada'); return p.$disconnect(); }
  console.log('Solución:', solucion.nombre, solucion.id);

  const orion = await p.agent.findUnique({ where: { slug: 'orion' } });
  if (!orion) { console.log('Agente Orion no encontrado'); return p.$disconnect(); }
  console.log('Agente:', orion.name, orion.id);

  // Crear épica ADE-0010
  const epic = await p.epic.create({
    data: {
      name: 'Orquestación & Activación',
      description: 'Activación del ciclo completo: portal detecta items asignados a Orion, los encola en el Harness, ejecuta con Claude Code y reporta resultado de vuelta al portal.',
      color: '#f59e0b',
      solucionId: solucion.id,
    }
  });
  console.log('✓ Épica creada:', epic.id);

  const sprints = [
    {
      sprintCode: 'ADE-0010-0001',
      name: 'Servicio de polling del Portal Bridge',
      goal: 'Implementar el loop de polling que detecta BacklogItems asignados a Orion y los encola automáticamente en el Harness.',
      items: [
        { code: 'ADE-0010-0001-001', title: 'Loop de polling cada 60s sobre /api/backlog', description: 'Implementar en sage_portal_bridge.py un loop asyncio que cada 60 segundos llame a get_assigned_tasks(agent_slug="orion", status="BACKLOG"), filtre los items no procesados y los pase al Harness. Evitar duplicados con un set de IDs ya encolados.' },
        { code: 'ADE-0010-0001-002', title: 'Marcar item como IN_PROGRESS al encolar', description: 'Al detectar un item nuevo, llamar a mark_in_progress(item_id) antes de enviarlo al Harness para que el portal refleje que está en proceso. Incluir timestamp de inicio.' },
        { code: 'ADE-0010-0001-003', title: 'Levantar sage-bridge como servicio pm2', description: 'Crear sage_bridge.py como punto de entrada del servicio de polling, levantarlo con pm2 start sage_bridge.py --name sage-bridge --interpreter python3, y persistirlo con pm2 save.' },
        { code: 'ADE-0010-0001-004', title: 'Manejo de errores y reconexión automática', description: 'El servicio debe sobrevivir errores de red o del portal: try/except en cada iteración del loop, backoff exponencial si el portal no responde, log de errores en el vault de Orion.' },
        { code: 'ADE-0010-0001-005', title: 'Test end-to-end: item en portal → encolado en Harness', description: 'Verificar que un BacklogItem asignado a Orion en el portal pasa a status IN_PROGRESS y aparece en la cola del Harness (GET /api/harness/queue/orion) dentro de 60 segundos.' },
      ]
    },
    {
      sprintCode: 'ADE-0010-0002',
      name: 'Routing interno de Orion',
      goal: 'Orion analiza cada tarea recibida y decide qué agente especializado la ejecuta según el tipo, área y palabras clave del título/descripción.',
      items: [
        { code: 'ADE-0010-0002-001', title: 'Definir tabla de routing Orion → agente', description: 'Crear en sage_executor.py o sage_discord.py una función orion_route(task) que mapea: DESARROLLO/arquitectura → Atlas, CRM/ventas/operaciones → Ares, datos/análisis/reportes → Iris, finanzas/legal/contratos → Vesta, sin match claro → Atlas como fallback.' },
        { code: 'ADE-0010-0002-002', title: 'Extracción de keywords del título y descripción', description: 'Implementar un extractor ligero de palabras clave que analiza title y description del BacklogItem para determinar el área. Usar listas de palabras por área (sin LLM para esta decisión de routing).' },
        { code: 'ADE-0010-0002-003', title: 'Notificación Discord al asignar internamente', description: 'Cuando Orion rutea una tarea a un agente, publicar en #backlog-hub un embed: "📋 Nueva tarea asignada a Atlas: [título] — en ejecución". Identidad del mensaje: Orion.' },
        { code: 'ADE-0010-0002-004', title: 'Log de decisiones de routing en vault de Orion', description: 'Cada decisión de routing queda registrada en sage-vault/agents/orion/logs/routing-YYYY-MM-DD.md con: taskCode, título, agente asignado, razón del routing, timestamp.' },
        { code: 'ADE-0010-0002-005', title: 'Test de routing con casos reales', description: 'Crear 5 BacklogItems de prueba con distintos tipos y verificar que cada uno es ruteado al agente correcto. Documentar los casos en el vault.' },
      ]
    },
    {
      sprintCode: 'ADE-0010-0003',
      name: 'Feedback al portal en tiempo real',
      goal: 'El portal refleja el estado real de ejecución: IN_PROGRESS mientras el agente trabaja, DONE con resultado al terminar, y notificación en Discord.',
      items: [
        { code: 'ADE-0010-0003-001', title: 'Actualizar status a IN_PROGRESS con timestamp de inicio', description: 'Al iniciar la ejecución de Claude Code headless, llamar a PortalClient.mark_in_progress(item_id) con fechaInicio. El portal debe mostrar el item como en ejecución con el agente responsable visible.' },
        { code: 'ADE-0010-0003-002', title: 'Guardar resultado en el portal al completar', description: 'Al finalizar la ejecución, llamar a PortalClient.mark_done(item_id, resultado=output_claude) con el output de Claude Code como resultado. Incluir duración total de la ejecución en el resultado.' },
        { code: 'ADE-0010-0003-003', title: 'Notificación Discord al completar', description: 'Publicar en #backlog-hub un embed de completion: agente, taskCode, título, duración, y primeras 300 chars del resultado. Color verde si DONE, rojo si falló.' },
        { code: 'ADE-0010-0003-004', title: 'Manejo de fallos: marcar como BLOCKED en el portal', description: 'Si la ejecución falla después de los reintentos, llamar a PortalClient.mark_blocked(item_id, error=mensaje) para que el humano pueda intervenir. Notificar en #backlog-hub con mención al responsable humano.' },
      ]
    },
  ];

  for (const sp of sprints) {
    const sprint = await p.sprint.create({
      data: {
        sprintCode: sp.sprintCode,
        name: sp.name,
        goal: sp.goal,
        status: 'PLANNED',
        epicId: epic.id,
        solucionId: solucion.id,
      }
    });
    console.log('✓ Sprint:', sprint.sprintCode);

    for (const item of sp.items) {
      await p.backlogItem.create({
        data: {
          taskCode: item.code,
          title: item.title,
          description: item.description,
          type: 'DESARROLLO',
          priority: 'HIGH',
          status: 'BACKLOG',
          sprintId: sprint.id,
          solucionId: solucion.id,
          assigneeId: orion.id,
          assigneeName: 'AGENT - Orion',
        }
      });
      console.log('  ✓', item.code);
    }
  }

  await p.$disconnect();
}

run();
