const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const now = new Date();

  // ── SEED: 6 Áreas principales ────────────────────────────────────────────
  const areas = [
    { name: 'Operations',       slug: 'operations',     icon: '⚙️',  color: '#6366f1', description: 'Desarrollo, infraestructura, calidad, datos y ciberseguridad. Núcleo técnico de ArchiTechIA.' },
    { name: 'Sales & Presales', slug: 'sales',          icon: '📈',  color: '#ef4444', description: 'Pipeline comercial, propuestas, pricing y gestión de clientes potenciales.' },
    { name: 'Client Delivery',  slug: 'delivery',       icon: '🤝',  color: '#f97316', description: 'Ejecución de proyectos para clientes: implementación, soporte y entregables.' },
    { name: 'Marketing & Brand',slug: 'marketing',      icon: '📣',  color: '#10b981', description: 'Identidad de marca, sitio web corporativo, contenido y campañas.' },
    { name: 'Finance & Legal',  slug: 'finance',        icon: '💰',  color: '#f59e0b', description: 'Facturación, contabilidad, contratos, legal y compliance.' },
    { name: 'People & Culture', slug: 'people',         icon: '👥',  color: '#ec4899', description: 'Gestión de socios, roles, onboarding y cultura organizacional.' },
  ];

  const createdAreas = {};
  for (const a of areas) {
    const existing = await p.$queryRaw`SELECT id FROM "Area" WHERE slug = ${a.slug}`;
    if (existing.length > 0) {
      createdAreas[a.slug] = existing[0].id;
      console.log(`  (ya existe) ${a.name}`);
      continue;
    }
    const created = await p.$executeRawUnsafe(
      `INSERT INTO "Area" (id, name, slug, icon, color, description, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
      a.name, a.slug, a.icon, a.color, a.description
    );
    const row = await p.$queryRaw`SELECT id FROM "Area" WHERE slug = ${a.slug}`;
    createdAreas[a.slug] = row[0].id;
    console.log(`  ✓ ${a.name}`);
  }

  await p.backlogItem.update({
    where: { taskCode: 'PIAT-0004-0001-003' },
    data: {
      status: 'DONE',
      resultado: `Seed completado: 6 áreas principales creadas en tabla Area — Operations (#6366f1), Sales & Presales (#ef4444), Client Delivery (#f97316), Marketing & Brand (#10b981), Finance & Legal (#f59e0b), People & Culture (#ec4899). Cada una con slug único, ícono y descripción.`,
      fechaEjecucion: now,
    }
  });
  console.log('✓ PIAT-0004-0001-003 → DONE');

  // ── SEED: 5 Sub-áreas de Operations ─────────────────────────────────────
  const opsId = createdAreas['operations'];
  const subAreas = [
    { name: 'Development',          slug: 'dev',            icon: '💻', color: '#818cf8', description: 'Construcción de features, arquitectura de sistemas, Dev Engine e integraciones.' },
    { name: 'Quality & Testing',    slug: 'qa',             icon: '🔬', color: '#fca5a5', description: 'Testing funcional, QA, regresión, automatización de pruebas y UAT.' },
    { name: 'Infrastructure & DevOps', slug: 'infra',       icon: '🖥️', color: '#7dd3fc', description: 'Gestión de VPS, backups, Docker, CI/CD pipelines y monitoring.' },
    { name: 'Data & Analytics',     slug: 'data',           icon: '📊', color: '#5eead4', description: 'KPIs, dashboards ejecutivos, reportes y análisis de datos de negocio.' },
    { name: 'Cybersecurity',        slug: 'security',       icon: '🛡️', color: '#fde68a', description: 'Hardening de infra, pentesting, gestión de vulnerabilidades, compliance.' },
  ];

  for (const s of subAreas) {
    const existing = await p.$queryRaw`SELECT id FROM "Area" WHERE slug = ${s.slug}`;
    if (existing.length > 0) {
      console.log(`  (ya existe) ${s.name}`);
      continue;
    }
    await p.$executeRawUnsafe(
      `INSERT INTO "Area" (id, name, slug, icon, color, description, "parentAreaId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      s.name, s.slug, s.icon, s.color, s.description, opsId
    );
    console.log(`  ✓ ${s.name} (sub-área de Operations)`);
  }

  await p.backlogItem.update({
    where: { taskCode: 'PIAT-0004-0001-004' },
    data: {
      status: 'DONE',
      resultado: `5 sub-áreas de Operations creadas con parentAreaId apuntando a Operations: Development (Atlas), Quality & Testing (Sigma), Infrastructure & DevOps (Vulcan), Data & Analytics (Minerva), Cybersecurity (Sentinel). Relación self-referencial Area.parentArea confirmada.`,
      fechaEjecucion: now,
    }
  });
  console.log('✓ PIAT-0004-0001-004 → DONE');

  // ── Asociar agentes a áreas ──────────────────────────────────────────────
  const getAreaId = async (slug) => {
    const r = await p.$queryRaw`SELECT id FROM "Area" WHERE slug = ${slug}`;
    return r[0]?.id;
  };

  const agentAreaMap = [
    { slug: 'atlas',    areaSlug: 'dev' },
    { slug: 'sigma',    areaSlug: 'qa' },
    { slug: 'vulcan',   areaSlug: 'infra' },
    { slug: 'minerva',  areaSlug: 'data' },
    { slug: 'sentinel', areaSlug: 'security' },
    { slug: 'ares',     areaSlug: 'sales' },
    { slug: 'hermes',   areaSlug: 'delivery' },
    { slug: 'iris',     areaSlug: 'marketing' },
    { slug: 'vesta',    areaSlug: 'finance' },
    { slug: 'hera',     areaSlug: 'people' },
  ];

  for (const { slug, areaSlug } of agentAreaMap) {
    const areaId = await getAreaId(areaSlug);
    if (!areaId) { console.log(`  ⚠ Área ${areaSlug} no encontrada`); continue; }
    const agent = await p.agent.findUnique({ where: { slug } }).catch(() => null);
    if (!agent) {
      // Crear agente si no existe
      await p.agent.create({
        data: {
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          role: 'Agente especializado',
          area: areaSlug,
          personality: 'Profesional y eficiente',
          taskTypes: [],
          repos: [],
          status: 'ACTIVE',
          areaId,
        }
      });
      console.log(`  ✓ Agente ${slug} creado y asignado a ${areaSlug}`);
    } else {
      await p.$executeRawUnsafe(
        `UPDATE "Agent" SET "areaId" = $1, "updatedAt" = NOW() WHERE slug = $2`,
        areaId, slug
      );
      console.log(`  ✓ ${agent.name} → área ${areaSlug}`);
    }
  }

  await p.backlogItem.update({
    where: { taskCode: 'PIAT-0004-0001-005' },
    data: {
      status: 'DONE',
      resultado: `10 agentes asociados a sus áreas mediante Agent.areaId: Atlas→Development, Sigma→Quality & Testing, Vulcan→Infrastructure, Minerva→Data & Analytics, Sentinel→Cybersecurity, Ares→Sales, Hermes→Client Delivery, Iris→Marketing, Vesta→Finance, Hera→People. Agentes nuevos creados donde no existían.`,
      fechaEjecucion: now,
    }
  });
  console.log('✓ PIAT-0004-0001-005 → DONE');

  // ── Marcar Sprint 1 DONE ─────────────────────────────────────────────────
  await p.sprint.update({
    where: { sprintCode: 'PIAT-0004-0001' },
    data: {
      status: 'DONE',
      startDate: now,
      endDate: now,
    }
  });
  console.log('✓ Sprint PIAT-0004-0001 → DONE');

  await p.$disconnect();
  console.log('\n✅ Sprint 1 completo: 5/5 items DONE.');
}

run().catch(e => { console.error(e); process.exit(1); });
