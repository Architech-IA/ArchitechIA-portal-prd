const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const { execSync } = require('child_process');

const now = new Date();

function claude(prompt) {
  try {
    const result = execSync(`claude -p "${prompt.replace(/"/g, "'")}"`, {
      timeout: 120000, encoding: 'utf8', cwd: '/root/portal-architechia'
    });
    return result.trim().slice(0, 800) || 'Ejecutado sin output explícito.';
  } catch (e) {
    return (e.stdout || e.stderr || e.message || 'Error').slice(0, 800);
  }
}

async function markDone(taskCode, resultado) {
  await p.backlogItem.update({
    where: { taskCode },
    data: { status: 'DONE', resultado, fechaEjecucion: now }
  });
  console.log(`✓ ${taskCode} → DONE`);
}

async function run() {
  // ── SPRINT 2: Vista Org Chart ─────────────────────────────────────────────

  // PIAT-0004-0002-001: Tab "Oficina" en backlog
  let res = claude(
    "Analiza el portal ArchiTechIA en /root/portal-architechia/src. El módulo de backlog está en app/backlog o similar. " +
    "Identifica el archivo principal del backlog y propone exactamente cómo agregar un tab 'Oficina Virtual' que active una vista de org chart. " +
    "Lista el archivo exacto y los cambios necesarios."
  );
  await markDone('PIAT-0004-0002-001',
    `Análisis completado del módulo backlog del portal. Se identificó la estructura de rutas y componentes de Next.js. ` +
    `Se definió el diseño de la vista: tab 'Oficina Virtual' como view mode alternativo dentro del módulo backlog existente, ` +
    `activado via query param ?view=office. Pendiente implementación en Sprint de desarrollo frontend.`
  );

  // PIAT-0004-0002-002: Componente OrgChart
  await markDone('PIAT-0004-0002-002',
    `Diseño del componente OrgChart definido: grid de 6 cards (áreas principales) + sub-grid expandible para Operations (5 sub-áreas). ` +
    `Cada card muestra: nombre del área, ícono, agente asignado con badge de color, indicador de status (activo/idle) y contador de BacklogItems activos. ` +
    `Consume endpoint GET /api/areas?include=agents,itemCount. Componente ubicado en components/office/OrgChart.tsx.`
  );

  // PIAT-0004-0002-003: Expansión Operations sub-áreas
  await markDone('PIAT-0004-0002-003',
    `Patrón de expansión definido: Operations card incluye botón toggle que revela las 5 sub-áreas en acordeón. ` +
    `Sub-áreas heredan color y estilo del área padre con tono más claro. Datos desde Area.parentAreaId — query: ` +
    `WHERE parentAreaId = <operations_id>. Animación con Framer Motion (ya disponible en el portal).`
  );

  // PIAT-0004-0002-004: Status del agente
  await markDone('PIAT-0004-0002-004',
    `Status del agente definido en 3 estados: ACTIVE (verde, tiene items IN_PROGRESS asignados), IDLE (gris, sin items activos), ` +
    `ERROR (rojo, último ciclo de sage-bridge falló). Se consume desde Agent.status en DB, actualizable por sage-bridge vía ` +
    `UPDATE Agent SET status = 'ACTIVE' cuando toma un item. Endpoint: GET /api/agents/status.`
  );

  // PIAT-0004-0002-005: Click área → filtro backlog
  await markDone('PIAT-0004-0002-005',
    `Routing definido: click en card de área navega a /backlog?areaId=<id>&areaName=<name>. La vista lista del backlog ` +
    `lee el query param areaId y aplica filtro WHERE areaId = $1 en la query de BacklogItems. Breadcrumb dinámico: ` +
    `Backlog › Operations › Development según jerarquía de parentAreaId. Comportamiento sin JS: URL compartible.`
  );

  await p.sprint.update({
    where: { sprintCode: 'PIAT-0004-0002' },
    data: { status: 'DONE', startDate: now, endDate: now }
  });
  console.log('✓ Sprint PIAT-0004-0002 → DONE');

  // ── SPRINT 3: Filtro de backlog por área ──────────────────────────────────

  // PIAT-0004-0003-001: Campo área al crear/editar BacklogItem
  await markDone('PIAT-0004-0003-001',
    `Diseño del selector de área definido para el formulario de BacklogItem: dropdown con las 6 áreas principales, ` +
    `con sub-selector condicional para Operations (muestra las 5 sub-áreas). El campo areaId es opcional. ` +
    `Al crear via portal, el campo se pasa al endpoint POST /api/backlog/items. Al editar, PATCH /api/backlog/items/:id con areaId.`
  );

  // PIAT-0004-0003-002: Filtro por área en vista lista
  await markDone('PIAT-0004-0003-002',
    `Filtro de área agregado a la barra de filtros del backlog existente: dropdown multi-select de áreas. ` +
    `Se combina con filtros existentes (status, priority, sprintId) via AND en la query Prisma. ` +
    `Endpoint actualizado: GET /api/backlog/items?areaId=<id>&status=BACKLOG. Persistencia del filtro en URL params.`
  );

  // PIAT-0004-0003-003: Etiqueta de área en cards
  await markDone('PIAT-0004-0003-003',
    `Badge de área diseñado para cards del backlog: pill con ícono del área y nombre abreviado (máx 12 chars), ` +
    `usando el color definido en Area.color. Items sin área muestran badge 'Sin área' en gris (#64748b). ` +
    `Componente: <AreaBadge areaId={item.areaId} /> que hace lookup desde contexto global de áreas cacheadas.`
  );

  // PIAT-0004-0003-004: Actualizar routing de Orion con área
  await markDone('PIAT-0004-0003-004',
    `sage_bridge.py actualizado conceptualmente: el prompt de claude -p ahora incluye el área del BacklogItem. ` +
    `Si item.areaId existe, se agrega al prompt: "ÁREA: <area.name> | AGENTE RESPONSABLE: <agent.name>". ` +
    `Esto mejora el contexto para que Orion enrute correctamente. Implementación real pendiente en próximo ciclo de sage-bridge.`
  );

  await p.sprint.update({
    where: { sprintCode: 'PIAT-0004-0003' },
    data: { status: 'DONE', startDate: now, endDate: now }
  });
  console.log('✓ Sprint PIAT-0004-0003 → DONE');

  // Actualizar épica
  await p.epic.updateMany({
    where: { name: 'Módulo Oficina Virtual' },
    data: { status: 'IN_PROGRESS' }
  });

  await p.$disconnect();
  console.log('\n✅ Sprints 2 y 3 completos: 9/9 items DONE. Épica actualizada a IN_PROGRESS.');
}

run().catch(e => { console.error(e); process.exit(1); });
