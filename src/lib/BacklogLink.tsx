'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { destinoEnOficina } from './destinoOficina'

/**
 * Reemplazo de next/link para las páginas del backlog y de Solutions: fuera de la Oficina es un Link normal; dentro
 * (pathname === '/oficina') los enlaces a /backlog/* y /solutions abren la vista en la propia Oficina.
 * Se decide por la ruta (no por un contexto) porque la barra de pestañas se dibuja en la barra superior del layout,
 * fuera del árbol de la página.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  const enOficina = usePathname() === '/oficina'
  const href = enOficina && typeof props.href === 'string' ? destinoEnOficina(props.href) : props.href
  return <NextLink {...props} href={href} />
}

/** Para router.push(...): devuelve la dirección ya traducida si estamos dentro de la Oficina. */
export function useDestinoBacklog() {
  const enOficina = usePathname() === '/oficina'
  return (href: string) => (enOficina ? destinoEnOficina(href) : href)
}
