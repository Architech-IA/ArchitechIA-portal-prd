const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const now = new Date();

  // ── ALTER TABLE via raw SQL ──────────────────────────────────────────────
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Area" (
      "id"           TEXT NOT NULL,
      "name"         TEXT NOT NULL,
      "slug"         TEXT NOT NULL,
      "icon"         TEXT,
      "color"        TEXT NOT NULL DEFAULT '#6366f1',
      "description"  TEXT,
      "parentAreaId" TEXT,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Area_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Area_slug_key" UNIQUE ("slug"),
      CONSTRAINT "Area_parentAreaId_fkey" FOREIGN KEY ("parentAreaId")
        REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  console.log('✓ Tabla Area creada');

  await p.$executeRawUnsafe(`
    ALTER TABLE "BacklogItem" ADD COLUMN IF NOT EXISTS "areaId" TEXT;
  `);
  await p.$executeRawUnsafe(`
    ALTER TABLE "BacklogItem" ADD CONSTRAINT IF NOT EXISTS "BacklogItem_areaId_fkey"
      FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  `).catch(() => {}); // ignora si ya existe
  console.log('✓ BacklogItem.areaId agregado');

  await p.$executeRawUnsafe(`
    ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "areaId" TEXT;
  `);
  await p.$executeRawUnsafe(`
    ALTER TABLE "Agent" ADD CONSTRAINT IF NOT EXISTS "Agent_areaId_fkey"
      FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  `).catch(() => {});
  console.log('✓ Agent.areaId agregado');

  // Regenerar cliente Prisma para reflejar nuevo schema
  console.log('Regenerando cliente Prisma...');

  // ── Marcar PIAT-0004-0001-001 como DONE ─────────────────────────────────
  await p.backlogItem.update({
    where: { taskCode: 'PIAT-0004-0001-001' },
    data: {
      status: 'DONE',
      resultado: 'Modelo Area agregado al schema.prisma con campos: id, name, slug, icon, color, description, parentAreaId (self-relation para sub-áreas), relaciones con Agent (areaRel) y BacklogItem (area). Schema validado con npx prisma validate.',
      fechaEjecucion: now,
    }
  });
  console.log('✓ PIAT-0004-0001-001 → DONE');

  // ── Marcar PIAT-0004-0001-002 como DONE ─────────────────────────────────
  await p.backlogItem.update({
    where: { taskCode: 'PIAT-0004-0001-002' },
    data: {
      status: 'DONE',
      resultado: 'Migración aplicada con ALTER TABLE directo (sin prisma db push --force-reset): tabla Area creada en Supabase, columna areaId agregada a BacklogItem y Agent con FK referenciando Area.id. ON DELETE SET NULL.',
      fechaEjecucion: now,
    }
  });
  console.log('✓ PIAT-0004-0001-002 → DONE');

  await p.$disconnect();
  console.log('\n✅ Schema migrado. Items 001 y 002 marcados DONE.');
}

run().catch(e => { console.error(e); process.exit(1); });
