import { prisma } from '@/lib/prisma'

/**
 * Regla real del negocio: toda Solucion debe tener un solucionCode (sin el
 * cual sus Sprints/Tasks caen al prefijo generico "SP", indistinguible de
 * cualquier otra Solucion sin codigo). Antes esta generacion solo vivia
 * inline en src/app/api/soluciones/route.ts (creacion manual desde la UI) —
 * las otras 3 rutas que tambien crean una Solucion (council/proposals,
 * council/proposals/[id]/plan/approve, soluciones/backfill) no la usaban y
 * dejaban solucionCode en NULL. Se extrae aca para que las 4 rutas usen la
 * misma logica en vez de reimplementarla o, peor, olvidarla.
 */
export function generateSolucionCode(nombre: string): string {
  const stopWords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'a', 'en', 'por', 'para', 'con', 'the', 'of', 'and', '&'])
  // Bug real encontrado en produccion: split(/\s+/) solo separa por
  // espacios, asi que un guion largo suelto como separador ("Nombre —
  // Sufijo") queda como "palabra" propia — su primera letra (el guion
  // mismo) se colaba en el codigo final (ej. "FIS—P" en vez de "FISP").
  // Se filtra cualquier token sin al menos una letra o numero real.
  const words = nombre
    .split(/\s+/)
    .filter(w => w.length > 0 && /[a-zA-Z0-9]/.test(w) && !stopWords.has(w.toLowerCase()))
  return words.map(w => w[0].toUpperCase()).join('').slice(0, 6)
}

export async function uniqueSolucionCode(base: string): Promise<string> {
  let candidate = base, suffix = 2
  while (true) {
    const existing = await prisma.solucion.findFirst({ where: { solucionCode: candidate }, select: { id: true } })
    if (!existing) return candidate
    candidate = base.slice(0, 5) + suffix; suffix++
  }
}
