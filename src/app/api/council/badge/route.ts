import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT status, COUNT(*) as count FROM "CouncilProposal"
     WHERE status IN ('DEBATING', 'ESCALATED')
     GROUP BY status`
  )
  const debating = Number(rows.find((r: any) => r.status === 'DEBATING')?.count ?? 0)
  const escalated = Number(rows.find((r: any) => r.status === 'ESCALATED')?.count ?? 0)
  return NextResponse.json({ debating, escalated, total: debating + escalated })
}
