'use client'

import HubSolucion from './HubSolucion'

export default function SolucionDetailPage({ params }: { params?: Promise<{ id: string }> } = {}) {
  return <HubSolucion params={params} />
}
