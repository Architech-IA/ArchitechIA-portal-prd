/** Busca una sección "Pasos de ejecución" (o similar) en el markdown y extrae su lista numerada.
 *  Si no encuentra esa sección, cae al primer bloque de lista numerada que encuentre en todo el documento. */
export function extractStepsFromPlan(markdown: string): string[] {
  const lines = markdown.split('\n')
  let inTarget = false
  let foundSection = false
  let collected: string[] = []

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.*)/)
    if (heading) {
      if (/pasos|ejecuci[oó]n|roadmap|implementaci[oó]n/i.test(heading[1])) {
        inTarget = true
        foundSection = true
        continue
      } else if (inTarget) {
        break
      }
    }
    if (inTarget) {
      const item = line.match(/^\s*\d+\.\s+(.*)/)
      if (item) collected.push(item[1].trim())
    }
  }
  if (foundSection && collected.length > 0) return collected.map(s => s.replace(/\*\*/g, ''))

  // Fallback: primer bloque de lista numerada en todo el documento
  collected = []
  let collecting = false
  for (const line of lines) {
    const item = line.match(/^\s*\d+\.\s+(.*)/)
    if (item) {
      collecting = true
      collected.push(item[1].trim())
    } else if (collecting && line.trim() !== '') {
      break
    }
  }
  return collected.map(s => s.replace(/\*\*/g, ''))
}
