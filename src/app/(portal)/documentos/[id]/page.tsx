import { DetallePagina } from '../DocumentosView'

export const dynamic = 'force-dynamic'

export default async function PaginaDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DetallePagina id={id} />
}
