import { NextResponse } from 'next/server'

const VPS_URL   = process.env.VPS_METRICS_URL   || ''
const VPS_TOKEN = process.env.VPS_METRICS_TOKEN || ''

// KVM2 (servidor de reserva): tiempo límite corto y «sin respuesta» con 200 en vez de 500/502.
export async function GET() {
  if (!VPS_URL) return NextResponse.json({ error: 'VPS_METRICS_URL no configurada' }, { status: 503 })
  try {
    const res = await fetch(VPS_URL + '/docker', {
      headers: { Authorization: 'Bearer ' + VPS_TOKEN },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return NextResponse.json({ error: 'El agente respondió ' + res.status, sinRespuesta: true })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'Sin respuesta del servidor (tiempo agotado)', sinRespuesta: true })
  }
}
