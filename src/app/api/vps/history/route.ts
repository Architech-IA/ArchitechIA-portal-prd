import { NextResponse } from 'next/server'

const VPS_URL   = process.env.VPS_METRICS_URL   || ''
const VPS_TOKEN = process.env.VPS_METRICS_TOKEN || ''

export async function GET() {
  if (!VPS_URL) return NextResponse.json({ snapshots: [] })
  try {
    const res = await fetch(`${VPS_URL}/history`, {
      headers: VPS_TOKEN ? { Authorization: `Bearer ${VPS_TOKEN}` } : {},
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ snapshots: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ snapshots: [] })
  }
}
