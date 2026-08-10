import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const areaId = searchParams.get('areaId')
  let rows: any[]
  if (areaId) {
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, message, "actionType", "backlogItemId", "backlogItemTitle", "backlogItemCode", metadata, "createdAt"
       FROM "OrionLog"
       WHERE "actionType" = 'DISPATCHED' AND metadata->>'toAreaId' = $1
       ORDER BY "createdAt" DESC LIMIT 40`,
      areaId
    )
  } else {
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, message, "actionType", "backlogItemId", "backlogItemTitle", "backlogItemCode", metadata, "createdAt"
       FROM "OrionLog" ORDER BY "createdAt" DESC LIMIT 60`
    )
  }
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.INTERNAL_API_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, actionType = 'INFO', backlogItemId, backlogItemTitle, backlogItemCode, metadata } = await req.json()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  await prisma.$executeRawUnsafe(
    `INSERT INTO "OrionLog" (message, "actionType", "backlogItemId", "backlogItemTitle", "backlogItemCode", metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    message, actionType, backlogItemId ?? null, backlogItemTitle ?? null,
    backlogItemCode ?? null, metadata ? JSON.stringify(metadata) : null
  )
  return NextResponse.json({ ok: true })
}
