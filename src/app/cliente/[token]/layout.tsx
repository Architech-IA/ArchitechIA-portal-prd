import type { Metadata } from 'next'

// El enlace del cliente es personal: que ningún buscador lo indexe.
export const metadata: Metadata = {
  title: 'Seguimiento del proyecto',
  robots: { index: false, follow: false },
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return children
}
