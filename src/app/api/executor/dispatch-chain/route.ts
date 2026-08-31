import { NextRequest, NextResponse } from 'next/server'
import { runTaskChain } from '@/lib/executor/taskGraph'

export async function POST(req: NextRequest) {
  const { taskIds } = await req.json()
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: 'taskIds (array) requerido' }, { status: 400 })
  }
  try {
    const results = await runTaskChain(taskIds)
    return NextResponse.json({ ok: true, results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
