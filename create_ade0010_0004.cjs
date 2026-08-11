const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const epic = await p.epic.findFirst({ where: { name: { contains: 'Orquestación' } } });
  if (!epic) { console.log('Épica no encontrada'); return p.$disconnect(); }

  const solucion = await p.solucion.findUnique({ where: { id: epic.solucionId } });
  const orion = await p.agent.findUnique({ where: { slug: 'orion' } });

  console.log('Épica:', epic.name, epic.id);
  console.log('Solución:', solucion.nombre);
  console.log('Agente:', orion.name);

  const sprint = await p.sprint.create({
    data: {
      sprintCode: 'ADE-0010-0004',
      name: 'Activación en Producción',
      goal: 'Levantar el ciclo completo en producción: sage-bridge como daemon, conectado al Harness real, ejecutando tareas del portal con Claude Code headless y reportando resultados de vuelta.',
      status: 'PLANNED',
      epicId: epic.id,
      solucionId: solucion.id,
    }
  });
  console.log('✓ Sprint creado:', sprint.sprintCode);

  const items = [
    {
      code: 'ADE-0010-0004-001',
      title: 'Levantar sage-bridge como daemon pm2',
      description: 'Ejecutar pm2 start /root/sage_portal_bridge.py --name sage-bridge --interpreter python3 y verificar que el loop de polling arranca correctamente. Confirmar con pm2 logs sage-bridge que detecta items asignados a Orion. Persistir con pm2 save.',
    },
    {
      code: 'ADE-0010-0004-002',
      title: 'Conectar sage-bridge al Harness real (harness_api.py)',
      description: 'Integrar el cliente HTTP del bridge con harness_api.py en /root/. Verificar que un item detectado por el bridge llega correctamente a la cola del Harness (POST /harness/queue) y queda registrado con status IN_PROGRESS tanto en el Harness como en el portal.',
    },
    {
      code: 'ADE-0010-0004-003',
      title: 'Verificar claude -p desde el contexto del bridge',
      description: 'Confirmar que claude -p funciona correctamente cuando es invocado por sage_portal_bridge.py o sage_executor.py desde el VPS. Verificar autenticación OAuth activa, timeout configurado y que el output se captura correctamente para guardarlo como resultado en el portal.',
    },
    {
      code: 'ADE-0010-0004-004',
      title: 'Test end-to-end con item real del portal',
      description: 'Crear un BacklogItem de prueba en el portal, asignarlo a AGENT - Orion, y verificar el ciclo completo: detección por bridge (~60s) → status IN_PROGRESS en portal → routing por Orion → ejecución Claude Code → status DONE en portal con resultado → notificación embed en #backlog-hub.',
    },
    {
      code: 'ADE-0010-0004-005',
      title: 'Monitoreo y alertas del servicio en producción',
      description: 'Configurar pm2 para reinicio automático del bridge ante fallos. Crear script de health check que verifique que sage-bridge, sage-discord y harness_api están activos. Agregar alerta en #backlog-hub si algún servicio cae (watchdog simple con cron cada 5 minutos).',
    },
  ];

  for (const item of items) {
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
    console.log('  ✓', item.code, '—', item.title);
  }

  await p.$disconnect();
  console.log('\nADE-0010-0004 creado con 5 items.');
}

run();
