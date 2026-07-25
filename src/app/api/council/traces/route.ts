import { NextRequest, NextResponse } from 'next/server'

const HOST_API = 'http://host-gateway:8649'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get('limit') || '50'
  const q = searchParams.get('q') || ''
  try {
    const url = q
      ? `${HOST_API}/traces?limit=${limit}&q=${encodeURIComponent(q)}`
      : `${HOST_API}/traces?limit=${limit}`
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ traces: [] })
  }
}
