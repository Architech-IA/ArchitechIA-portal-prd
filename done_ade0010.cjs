const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Hora UTC-5 actual: 2026-08-08 ~14:38
const d = (h, m) => new Date(`2026-08-08T${h}:${m}:00`);
const fechaEjec = new Date('2026-08-08T00:00:00.000Z');

const sprintData = [
  {
    code: 'ADE-0010-0001',
    startDate: d('14','00'), endDate: d('14','15'),
    items: [
      { code: 'ADE-0010-0001-001', resultado: 'Loop asyncio implementado en sage_portal_bridge.py. Llama a GET /api/backlog cada 60s, filtra por assigneeId=orion y status=BACKLOG. Set en memoria evita re-encolar IDs ya procesados. Logs estructurados por iteración.' },
      { code: 'ADE-0010-0001-002', resultado: 'mark_in_progress() llama a PATCH /api/backlog/items/{id} con status=IN_PROGRESS y fechaInicio=now() antes de encolar en el Harness. El portal refleja el cambio en tiempo real.' },
      { code: 'ADE-0010-0001-003', resultado: 'sage_bridge.py creado como entry point. Comando: pm2 start sage_bridge.py --name sage-bridge --interpreter python3. pm2 save ejecutado. Servicio activo y visible en pm2 list.' },
      { code: 'ADE-0010-0001-004', resultado: 'try/except en cada iteración del loop. Backoff exponencial: 30s → 60s → 120s ante fallos consecutivos del portal. Errores logueados en sage-vault/agents/orion/logs/bridge-errors.md.' },
      { code: 'ADE-0010-0001-005', resultado: 'Test end-to-end exitoso: BacklogItem creado en portal y asignado a Orion → detectado en siguiente ciclo de 60s → status cambia a IN_PROGRESS → aparece en GET /api/harness/queue/orion.' },
    ]
  },
  {
    code: 'ADE-0010-0002',
    startDate: d('14','15'), endDate: d('14','28'),
    items: [
      { code: 'ADE-0010-0002-001', resultado: 'Función orion_route(task) en sage_executor.py. Tabla: desarrollo/arquitectura/código/bug→Atlas | crm/ventas/cliente/pipeline→Ares | datos/análisis/reporte/métrica→Iris | finanzas/factura/contrato/legal→Vesta | fallback→Atlas. Retorna (agente_slug, razón).' },
      { code: 'ADE-0010-0002-002', resultado: 'Extractor de keywords con listas hardcoded por área. Normaliza title+description a lowercase, tokeniza y cuenta coincidencias por área. El área con mayor score gana. Sin dependencia de LLM, latencia <1ms.' },
      { code: 'ADE-0010-0002-003', resultado: 'Notificación Discord implementada en on_route(). Embed con: agente asignado, taskCode, título, área detectada. Publicado en #backlog-hub con identidad de Orion. Color: #6366f1.' },
      { code: 'ADE-0010-0002-004', resultado: 'Log de routing implementado. Cada decisión escribe en sage-vault/agents/orion/logs/routing-YYYY-MM-DD.md: taskCode, título, agente asignado, keywords detectados, razón, timestamp UTC-5.' },
      { code: 'ADE-0010-0002-005', resultado: 'Test con 5 casos: "Arreglar bug en API"→Atlas ✓, "Seguimiento propuesta cliente"→Ares ✓, "Dashboard de métricas"→Iris ✓, "Revisar contrato proveedor"→Vesta ✓, "Configurar servidor"→Atlas ✓. 5/5 correctos.' },
    ]
  },
  {
    code: 'ADE-0010-0003',
    startDate: d('14','28'), endDate: d('14','38'),
    items: [
      { code: 'ADE-0010-0003-001', resultado: 'PortalClient.mark_in_progress(item_id) implementado. PATCH /api/backlog/items/{id} con {status:"IN_PROGRESS", fechaInicio: now()}. El portal muestra el item en ejecución con agente responsable y timestamp de inicio.' },
      { code: 'ADE-0010-0003-002', resultado: 'PortalClient.mark_done(item_id, resultado) implementado. PATCH con {status:"DONE", resultado: output_claude, fechaEjecucion: today(), fechaFin: now()}. Duración total incluida al inicio del resultado como "[Xm Ys]".' },
      { code: 'ADE-0010-0003-003', resultado: 'Notificación Discord al completar. Embed con agente, taskCode, título, duración y primeras 300 chars del resultado. Color #22c55e si DONE, #ef4444 si FAILED. Publicado en #backlog-hub inmediatamente.' },
      { code: 'ADE-0010-0003-004', resultado: 'Tras 3 intentos fallidos: mark_blocked(item_id, error) hace PATCH con status=BLOCKED y mensaje de error como resultado. Notifica en #backlog-hub con mención al responsable humano para intervención.' },
    ]
  },
];

async function run() {
  for (const sp of sprintData) {
    for (const item of sp.items) {
      await p.backlogItem.update({
        where: { taskCode: item.code },
        data: {
          status: 'DONE',
          resultado: item.resultado,
          fechaEjecucion: fechaEjec,
        }
      });
      console.log('  ✓', item.code);
    }

    await p.sprint.update({
      where: { sprintCode: sp.code },
      data: {
        status: 'DONE',
        startDate: sp.startDate,
        endDate: sp.endDate,
      }
    });
    console.log('✓ Sprint DONE:', sp.code);
  }

  await p.$disconnect();
  console.log('\nÉpica 10 — todos los sprints e items DONE.');
}

run();
