/**
 * Dentro de la Oficina (/oficina) los enlaces del backlog y de Solutions se abren en la propia Oficina
 * (/oficina?view=backlog&tab=sprint…) en vez de sacar al usuario a otra página. Fuera de la Oficina no se usa.
 *
 *   /backlog                       → ?view=backlog
 *   /backlog/(sprint|epics|solution|control) → ?view=backlog&tab=…
 *   /backlog/control/multi?ids=a,b → ?view=backlog&tab=control&multi=1&ids=a,b
 *   /backlog/control/<sprintId>    → ?view=backlog&tab=control&sprint=<sprintId>
 *   /solutions                     → ?view=solutions
 * Cualquier otra dirección se devuelve igual.
 */
export function destinoEnOficina(href: string): string {
  const [ruta, consulta = ''] = href.split('?')
  const extra = new URLSearchParams(consulta)
  const con = (base: Record<string, string>) => {
    const p = new URLSearchParams(base)
    extra.forEach((v, k) => p.set(k, v))
    return '/oficina?' + p.toString()
  }
  if (ruta === '/solutions') return '/oficina?view=solutions'
  if (ruta === '/backlog') return '/oficina?view=backlog'
  let m = ruta.match(/^\/backlog\/(sprint|epics|solution|control)$/)
  if (m) return con({ view: 'backlog', tab: m[1] })
  if (ruta === '/backlog/control/multi') return con({ view: 'backlog', tab: 'control', multi: '1' })
  m = ruta.match(/^\/backlog\/control\/([^/]+)$/)
  if (m) return con({ view: 'backlog', tab: 'control', sprint: m[1] })
  return href
}
