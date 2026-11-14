'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import DocumentoEditor from '../oficina/proyectos/DocumentoEditor'

function Contenido() {
  const q = useSearchParams()
  const p = q.get('p') ?? '', fase = q.get('fase') ?? '', clave = q.get('clave') ?? ''
  if (!p || !fase || !clave) return <p className="p-8 text-[13px] text-[#7f8a9c]">Falta indicar el documento. Ábrelo desde el entregable de la fase.</p>
  const volver = () => { window.location.assign(`/oficina?view=proyectos&p=${encodeURIComponent(p)}&fase=${encodeURIComponent(fase)}`) }
  return <div className="h-[calc(100vh-64px)] flex flex-col"><DocumentoEditor pagina proyectoId={p} fase={fase} clave={clave} titulo={q.get('t') || 'Documento'} editable sesionId={q.get('s') || undefined} onCerrar={volver} onCambio={() => {}} /></div>
}

export default function PaginaDocumento() {
  return <Suspense fallback={<div className="p-8"><Loader2 size={18} className="animate-spin text-[#7f8a9c]" /></div>}><Contenido /></Suspense>
}
