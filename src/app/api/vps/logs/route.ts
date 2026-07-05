import { NextResponse } from 'next/server'

const VPS_URL   = process.env.VPS_METRICS_URL   || ''
const VPS_TOKEN = process.env.VPS_METRICS_TOKEN || ''

export async function GET() {
  if (!VPS_URL) return NextResponse.json({ lines: [] })
  try {
    const res = await fetch(`${VPS_URL}/logs`, {
      headers: VPS_TOKEN ? { Authorization: `Bearer ${VPS_TOKEN}` } : {},
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json({ lines: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ lines: [] })
  }
}
