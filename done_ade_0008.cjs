const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  // ADE-0008-0001: Aprobación humana
  {
    taskCode: 'ADE-0008-0001-001',
    fecha: '2026-08-07T12:13:00Z',
    resultado: 'Criterios de aprobación definidos en ALWAYS_REQUIRES_APPROVAL: {deploy, db_migration, delete_data, financial, publish, send_email, git_force_push, infrastructure}. HIGH_RISK_KEYWORDS: production, prod, eliminar, borrar, drop, truncate, force, override, reset, publish, deploy. También flag explícito requires_approval en el payload. needs_approval() retorna (bool, reason) para logging. 6 casos de test correctos.',
  },
  {
    taskCode: 'ADE-0008-0001-002',
    fecha: '2026-08-07T12:14:00Z',
    resultado: 'ApprovalStore implementado: almacena estado AWAITING_APPROVAL en Redis (harness:approval:{task_id}) con TTL=360s, fallback a JSON en /root/harness-queue/approvals/. Estados: pending → approved/rejected. Métodos: set_pending(), get(), set_decision(approved, reason), wait_for_decision(timeout) con polling cada 2s. Backend redis activo y verificado: set_pending → status=pending, set_decision(True) → approved.',
  },
  {
    taskCode: 'ADE-0008-0001-003',
    fecha: '2026-08-07T12:15:00Z',
    resultado: 'ApprovalView implementado como discord.ui.View: botones "✅ Aprobar" (ButtonStyle.success) y "❌ Rechazar" (ButtonStyle.danger). on_timeout() auto-cancela tras APPROVAL_TIMEOUT=300s. ApprovalManager.build_approval_embed() genera Embed naranja con título, razón, tipo, agente, ID[:8] y prompt[:500]. Embed verificado: 4 campos, color orange, título "⚠️ Tarea requiere aprobación".',
  },
  {
    taskCode: 'ADE-0008-0001-004',
    fecha: '2026-08-07T12:15:00Z',
    resultado: 'Handlers implementados: approve() → set_decision(True, "Aprobado por {user}") + deshabilita botones + edita mensaje "✅ Aprobada por @user"; reject() → set_decision(False, "Rechazada por {user}") + edita mensaje "❌ Rechazada por @user". request_async() envía embed al canal y espera view.wait(). request_sync() usa asyncio.run_coroutine_threadsafe para invocar desde hilos no-async del Executor.',
  },
  {
    taskCode: 'ADE-0008-0001-005',
    fecha: '2026-08-07T12:16:00Z',
    resultado: 'Test flujo completo de aprobación: 6 criterios validados (deploy→True, code_review→False, production→True, analizar→False, requires_approval flag→True, send_email→True). ApprovalStore Redis OK (set_pending, set_decision roundtrip). Embed 4 campos verificado. Botones [Aprobar, Rechazar] en view. Sin DISCORD_BOT_TOKEN el ApprovalManager auto-rechaza con log. Commit ab8d1ec pusheado.',
  },

  // ADE-0008-0002: Reportes
  {
    taskCode: 'ADE-0008-0002-001',
    fecha: '2026-08-07T12:14:00Z',
    resultado: 'Formato de reporte definido: sprint activo (código, nombre, goal), métricas (total, DONE, IN_PROGRESS, TODO, BACKLOG, % completado), barra de progreso visual (█░), tiempo promedio por tarea (calculado de fechaEjecucion-createdAt en horas), lista de items en progreso, últimas 5 completadas, hasta 3 en backlog. Diseño legible en markdown y como Discord embed con color verde/amarillo/rojo según % completado.',
  },
  {
    taskCode: 'ADE-0008-0002-002',
    fecha: '2026-08-07T12:14:00Z',
    resultado: 'SprintReporter.collect_sprint_data() implementado: GET /api/backlog/sprints filtra status=IN_PROGRESS, GET /api/backlog obtiene todos los items, filtra por sprint_id. Calcula Counter de status, listas por estado, duración promedio. Test real: sprint activo PIAT-0003-0001 — 5 items IN_PROGRESS, 0 DONE, 0% completado. Fallback: si no hay sprint IN_PROGRESS usa el DONE más reciente.',
  },
  {
    taskCode: 'ADE-0008-0002-003',
    fecha: '2026-08-07T12:15:00Z',
    resultado: 'build_discord_embed() implementado: Embed con título "📊 {code} — {name}", descripción con barra de progreso y %, color verde (≥80%), amarillo (≥40%), rojo (<40%). Campos: Done/En progreso/Pendiente/Tiempo promedio, lista de items en ejecución (max 4), últimas completadas (max 4). Test real: embed PIAT-0003-0001 con 4 campos generado correctamente.',
  },
  {
    taskCode: 'ADE-0008-0002-004',
    fecha: '2026-08-07T12:15:00Z',
    resultado: 'register_reporte_command(bot) implementado: función que recibe el SageDiscordBot e instala el slash command /reporte. Usa defer(thinking=True), genera embed via SprintReporter().build_discord_embed(), lo envía como followup. Diseñado como patch para no modificar sage_discord.py directamente: from sage_reporter import register_reporte_command; register_reporte_command(bot). Manejo de error con mensaje amigable.',
  },
  {
    taskCode: 'ADE-0008-0002-005',
    fecha: '2026-08-07T12:16:00Z',
    resultado: 'Test end-to-end con datos reales del portal: portal accesible OK, sprint activo PIAT-0003-0001 detectado (5 IN_PROGRESS, 0 DONE, 0%), markdown 844 chars generado correctamente, embed Discord 4 campos creado, barras de progreso 0%/50%/100% verificadas. El reporte refleja el estado real del backlog en tiempo real consultando el portal via PortalClient.',
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
  for (const code of ['ADE-0008-0001', 'ADE-0008-0002']) {
    await p.sprint.update({ where: { sprintCode: code }, data: { status: 'DONE' } });
    console.log('✓ Sprint ' + code + ' → DONE');
  }
  await p.$disconnect();
}

run();
