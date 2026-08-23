import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await req.json()
  const { defaultAgentId, defaultAgentName, executionStrategy } = body

  try {
    // Accept both slug and UUID in the path param
    await prisma.$executeRawUnsafe(
      `UPDATE "Area"
       SET "defaultAgentId" = COALESCE($2, "defaultAgentId"),
           "defaultAgentName" = COALESCE($3, "defaultAgentName"),
           "executionStrategy" = COALESCE($4, "executionStrategy")
       WHERE id = $1 OR slug = $1`,
      slug,
      defaultAgentId ?? null,
      defaultAgentName ?? null,
      executionStrategy ?? null
    )

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, name, slug, "defaultAgentId", "defaultAgentName", "executionStrategy"
       FROM "Area" WHERE id = $1 OR slug = $1`,
      slug
    ) as { id: string; name: string; slug: string; defaultAgentId: string; defaultAgentName: string; executionStrategy: string }[]

    return NextResponse.json(rows[0] ?? { error: 'not found' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error updating area' }, { status: 500 })
  }
}
