import { NextResponse } from 'next/server'

const VPS_URL   = process.env.VPS_METRICS_URL   || ''
const VPS_TOKEN = process.env.VPS_METRICS_TOKEN || ''

// KVM2 (servidor de reserva, estrangulado por Hostinger): si no responde pronto no es un error del portal,
// se informa «sin respuesta» con 200 para que el panel lo muestre sin llenar el registro de 502.
export async function GET() {
  if (!VPS_URL) {
    return NextResponse.json({ error: 'VPS_METRICS_URL no configurada' }, { status: 503 })
  }
  try {
    const res = await fetch(`${VPS_URL}/metrics`, {
      headers: VPS_TOKEN ? { Authorization: `Bearer ${VPS_TOKEN}` } : {},
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `El servidor respondió ${res.status}`, sinRespuesta: true })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'Sin respuesta del servidor (tiempo agotado)', sinRespuesta: true })
  }
}
