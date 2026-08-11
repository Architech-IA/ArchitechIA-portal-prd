const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Buscar solución PIAT
  const sol = await p.solucion.findFirst({ where: { nombre: { contains: 'Portal' } } });
  if (!sol) { console.log('Solución PIAT no encontrada'); return p.$disconnect(); }
  console.log('Solución:', sol.nombre, sol.id);

  // Buscar agente Orion para asignar los items
  const orion = await p.agent.findFirst({ where: { slug: 'orion' } });
  console.log('Agente coordinador:', orion?.name);

  // Crear Épica PIAT-0004
  const epic = await p.epic.create({
    data: {
      name: 'Módulo Oficina Virtual',
      description: 'Diseño e implementación del módulo de Oficina Virtual en el portal: modelo de datos de Áreas y Agentes, vista org chart interactiva dentro del backlog, y filtros por área.',
      status: 'PLANNED',
      solucionId: sol.id,
    }
  });
  console.log('✓ Épica creada:', epic.name, epic.id);

  // ─── SPRINT 1 ────────────────────────────────────────────
  const s1 = await p.sprint.create({
    data: {
      sprintCode: 'PIAT-0004-0001',
      name: 'Modelo de Datos — Áreas & Agentes',
      goal: 'Definir y migrar el schema de Prisma con el modelo Area, sus relaciones con Agent y BacklogItem, y poblar la DB con las 6 áreas y 10 agentes de la oficina virtual.',
      status: 'PLANNED',
      epicId: epic.id,
      solucionId: sol.id,
    }
  });
  console.log('✓ Sprint:', s1.sprintCode);

  const items1 = [
    {
      code: 'PIAT-0004-0001-001',
      title: 'Crear modelo Area en Prisma schema',
      description: 'Agregar modelo Area al schema.prisma con campos: id, name, slug, icon, color, description, parentAreaId (self-relation para sub-áreas), agentId, solucionId. Incluir relación con Agent (uno a uno) y con BacklogItem (uno a muchos).',
    },
    {
      code: 'PIAT-0004-0001-002',
      title: 'Migrar schema con ALTER TABLE directo',
      description: 'Aplicar los cambios del modelo Area al schema de Supabase usando ALTER TABLE directo (NUNCA prisma db push --force-reset). Agregar tabla areas, columna area_id en backlog_items con FK nullable.',
    },
    {
      code: 'PIAT-0004-0001-003',
      title: 'Seed de las 6 áreas principales',
      description: 'Crear script de seed para las 6 áreas de la oficina virtual: Operations, Sales & Presales, Client Delivery, Marketing & Brand, Finance & Legal, People & Culture. Cada una con su slug, ícono y color.',
    },
    {
      code: 'PIAT-0004-0001-004',
      title: 'Seed de las 5 sub-áreas de Operations',
      description: 'Crear las 5 sub-áreas de Operations con parentAreaId apuntando al área padre: Development (Atlas), Quality & Testing (Sigma), Infrastructure & DevOps (Vulcan), Data & Analytics (Minerva), Cybersecurity (Sentinel).',
    },
    {
      code: 'PIAT-0004-0001-005',
      title: 'Asociar agentes existentes a sus áreas',
      description: 'Actualizar los registros de Agent en DB para asignar cada agente a su área: Orion (transversal), Atlas (Development), Sigma (Quality & Testing), Vulcan (Infrastructure), Minerva (Data & Analytics), Sentinel (Cybersecurity), Ares (Sales), Hermes (Client Delivery), Iris (Marketing), Vesta (Finance), Hera (People).',
    },
  ];

  for (const item of items1) {
    await p.backlogItem.create({
      data: {
        taskCode: item.code,
        title: item.title,
        description: item.description,
        type: 'DESARROLLO',
        priority: 'HIGH',
        status: 'BACKLOG',
        sprintId: s1.id,
        solucionId: sol.id,
        assigneeId: orion?.id,
        assigneeName: orion?.name ?? 'AGENT - Orion',
      }
    });
    console.log('  ✓', item.code);
  }

  // ─── SPRINT 2 ────────────────────────────────────────────
  const s2 = await p.sprint.create({
    data: {
      sprintCode: 'PIAT-0004-0002',
      name: 'Vista Org Chart en el Portal',
      goal: 'Implementar la vista visual de la Oficina Virtual dentro del módulo de backlog: org chart interactivo con tarjetas por área, agente asignado, status y contador de tareas activas.',
      status: 'PLANNED',
      epicId: epic.id,
      solucionId: sol.id,
    }
  });
  console.log('✓ Sprint:', s2.sprintCode);

  const items2 = [
    {
      code: 'PIAT-0004-0002-001',
      title: 'Tab "Oficina" dentro del módulo Backlog',
      description: 'Agregar una pestaña o modo de vista "Oficina Virtual" en el módulo de backlog del portal, al mismo nivel que la vista lista o kanban. La ruta puede ser /backlog?view=office o un toggle en la UI.',
    },
    {
      code: 'PIAT-0004-0002-002',
      title: 'Componente OrgChart — grid de áreas principales',
      description: 'Desarrollar el componente que muestra las 6 áreas en un grid visual. Cada card muestra: nombre del área, ícono, agente asignado con su status (activo/idle), y contador de tareas activas en esa área.',
    },
    {
      code: 'PIAT-0004-0002-003',
      title: 'Expansión de Operations con sub-áreas',
      description: 'Dentro del org chart, el área Operations debe expandirse mostrando sus 5 sub-áreas (Atlas, Sigma, Vulcan, Minerva, Sentinel) en un sub-grid o acordeón. Las sub-áreas también muestran agente y contador de tareas.',
    },
    {
      code: 'PIAT-0004-0002-004',
      title: 'Status visual del agente en tiempo real',
      description: 'Indicador visual de estado por agente: activo (verde, procesando tareas), idle (gris, sin tareas pendientes), error (rojo, fallo en último ciclo). Consumir desde pm2 status o desde el portal bridge.',
    },
    {
      code: 'PIAT-0004-0002-005',
      title: 'Click en área → filtro de backlog',
      description: 'Al hacer click en una card de área dentro del org chart, navegar a la vista lista del backlog filtrada por esa área. Mantener el filtro activo y mostrar breadcrumb "Backlog › Operations › Development".',
    },
  ];

  for (const item of items2) {
    await p.backlogItem.create({
      data: {
        taskCode: item.code,
        title: item.title,
        description: item.description,
        type: 'DESARROLLO',
        priority: 'HIGH',
        status: 'BACKLOG',
        sprintId: s2.id,
        solucionId: sol.id,
        assigneeId: orion?.id,
        assigneeName: orion?.name ?? 'AGENT - Orion',
      }
    });
    console.log('  ✓', item.code);
  }

  // ─── SPRINT 3 ────────────────────────────────────────────
  const s3 = await p.sprint.create({
    data: {
      sprintCode: 'PIAT-0004-0003',
      name: 'Filtro de Backlog por Área',
      goal: 'Conectar el modelo Area con el backlog real: campo de área al crear/editar items, filtro por área en la vista lista, etiquetas de área en cards, y actualización del routing de Orion para incluir área en el dispatch.',
      status: 'PLANNED',
      epicId: epic.id,
      solucionId: sol.id,
    }
  });
  console.log('✓ Sprint:', s3.sprintCode);

  const items3 = [
    {
      code: 'PIAT-0004-0003-001',
      title: 'Campo área al crear/editar BacklogItem',
      description: 'Agregar selector de área en el formulario de creación y edición de BacklogItems. El selector debe mostrar las 6 áreas principales con opción de sub-área cuando corresponda. Guardar areaId en DB.',
    },
    {
      code: 'PIAT-0004-0003-002',
      title: 'Filtro por área en vista lista del backlog',
      description: 'Agregar filtro de área en la barra de filtros del backlog existente. Debe permitir filtrar por área principal (Operations, Sales, etc.) y por sub-área (Development, Cybersecurity, etc.). Combina con filtros existentes de status y prioridad.',
    },
    {
      code: 'PIAT-0004-0003-003',
      title: 'Etiqueta de área en cards del backlog',
      description: 'Mostrar un badge/tag con el área asignada en cada card de backlog. El badge usa el color e ícono del área. Si el item no tiene área asignada, mostrar "Sin área" en gris.',
    },
    {
      code: 'PIAT-0004-0003-004',
      title: 'Actualizar routing de Orion con área',
      description: 'Modificar sage_bridge.py para incluir el área del BacklogItem en el prompt enviado a Claude. Si el item tiene areaId, el prompt debe incluir el contexto del área y el agente responsable, mejorando la precisión del routing interno de Orion.',
    },
  ];

  for (const item of items3) {
    await p.backlogItem.create({
      data: {
        taskCode: item.code,
        title: item.title,
        description: item.description,
        type: 'DESARROLLO',
        priority: 'MEDIUM',
        status: 'BACKLOG',
        sprintId: s3.id,
        solucionId: sol.id,
        assigneeId: orion?.id,
        assigneeName: orion?.name ?? 'AGENT - Orion',
      }
    });
    console.log('  ✓', item.code);
  }

  await p.$disconnect();
  console.log('\n✅ PIAT-0004 creado: 1 épica, 3 sprints, 14 items.');
}

run().catch(e => { console.error(e); process.exit(1); });
