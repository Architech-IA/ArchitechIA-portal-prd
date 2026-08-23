import { NextRequest, NextResponse } from 'next/server'
import { dispatchTask } from '@/lib/executor/taskDispatcher'

export async function POST(req: NextRequest) {
  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  try {
    const result = await dispatchTask(taskId)
    return NextResponse.json(result, { status: 202 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
