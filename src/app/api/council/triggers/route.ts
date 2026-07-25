import { NextResponse } from 'next/server'

const HOST = 'http://host-gateway:8649'

export async function GET() {
  try {
    const res = await fetch(`${HOST}/triggers`, { cache: 'no-store' })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ triggers: [] })
  }
}
