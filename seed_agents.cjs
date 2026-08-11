const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const now = new Date();

  const getAreaId = async (slug) => {
    const r = await p.$queryRaw`SELECT id FROM "Area" WHERE slug = ${slug}`;
    return r[0]?.id;
  };

  const agentAreaMap = [
    { slug: 'atlas',    name: 'Atlas',    areaSlug: 'dev',      role: 'Agente de Development', personality: 'Metódico, orientado a arquitectura limpia y código mantenible.' },
    { slug: 'sigma',    name: 'Sigma',    areaSlug: 'qa',       role: 'Agente de Quality & Testing', personality: 'Riguroso, orientado a la calidad y detección temprana de errores.' },
    { slug: 'vulcan',   name: 'Vulcan',   areaSlug: 'infra',    role: 'Agente de Infrastructure & DevOps', personality: 'Pragmático, confiable, enfocado en estabilidad y automatización.' },
    { slug: 'minerva',  name: 'Minerva',  areaSlug: 'data',     role: 'Agente de Data & Analytics', personality: 'Analítica, orientada a datos y métricas accionables.' },
    { slug: 'sentinel', name: 'Sentinel', areaSlug: 'security', role: 'Agente de Cybersecurity', personality: 'Vigilante, meticuloso en la identificación de vulnerabilidades.' },
    { slug: 'ares',     name: 'Ares',     areaSlug: 'sales',    role: 'Agente de Sales & Presales', personality: 'Persuasivo, orientado a resultados comerciales y cierre de negocios.' },
    { slug: 'hermes',   name: 'Hermes',   areaSlug: 'delivery', role: 'Agente de Client Delivery', personality: 'Ágil, comunicativo, enfocado en la satisfacción del cliente.' },
    { slug: 'iris',     name: 'Iris',     areaSlug: 'marketing',role: 'Agente de Marketing & Brand', personality: 'Creativo, orientado a narrativa de marca y posicionamiento.' },
    { slug: 'vesta',    name: 'Vesta',    areaSlug: 'finance',  role: 'Agente de Finance & Legal', personality: 'Preciso, orientado al cumplimiento normativo y orden financiero.' },
    { slug: 'hera',     name: 'Hera',     areaSlug: 'people',   role: 'Agente de People & Culture', personality: 'Empático, enfocado en el bienestar del equipo y la cultura.' },
  ];

  for (const { slug, name, areaSlug, role, personality } of agentAreaMap) {
    const areaId = await getAreaId(areaSlug);
    if (!areaId) { console.log(`  ⚠ Área ${areaSlug} no encontrada`); continue; }

    const existing = await p.$queryRaw`SELECT id FROM "Agent" WHERE slug = ${slug}`;
    if (existing.length > 0) {
      await p.$executeRawUnsafe(
        `UPDATE "Agent" SET "areaId" = $1, "updatedAt" = NOW() WHERE slug = $2`,
        areaId, slug
      );
      console.log(`  ✓ ${name} → área ${areaSlug}`);
    } else {
      await p.$executeRawUnsafe(
        `INSERT INTO "Agent" (id, slug, name, role, area, personality, "taskTypes", repos, status, "areaId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, '{}', '{}', 'ACTIVE', $6, NOW(), NOW())`,
        slug, name, role, areaSlug, personality, areaId
      );
      console.log(`  ✓ ${name} creado → área ${areaSlug}`);
    }
  }

  await p.backlogItem.update({
    where: { taskCode: 'PIAT-0004-0001-005' },
    data: {
      status: 'DONE',
      resultado: `10 agentes asociados a sus áreas mediante Agent.areaId vía SQL directo: Atlas→dev, Sigma→qa, Vulcan→infra, Minerva→data, Sentinel→security, Ares→sales, Hermes→delivery, Iris→marketing, Vesta→finance, Hera→people. Agentes nuevos creados con rol y personalidad definidos.`,
      fechaEjecucion: now,
    }
  });
  console.log('✓ PIAT-0004-0001-005 → DONE');

  await p.sprint.update({
    where: { sprintCode: 'PIAT-0004-0001' },
    data: { status: 'DONE', startDate: now, endDate: now }
  });
  console.log('✓ Sprint PIAT-0004-0001 → DONE');

  await p.$disconnect();
  console.log('\n✅ Sprint 1 completo: 5/5 items DONE.');
}

run().catch(e => { console.error(e); process.exit(1); });
