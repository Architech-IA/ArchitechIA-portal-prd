// Shared session parsing utilities — used by PlanVisualView and CronogramaTimeline

export interface SesionCard {
  numero: string
  titulo: string
  body: string
}

export interface SesionFields {
  objetivo: string
  prerequisitos: string
  prompt: string        // code-fence stripped, ready for copy/display
  tareas: string
  validacion: string
  estado: string
}

/** Parse all ### Sesión N headings from the "Sesiones de trabajo" ## section */
export function parseSesionesFromMarkdown(md: string): SesionCard[] {
  const lines = md.split('\n')
  let inSesiones = false
  let current: SesionCard | null = null
  const sesiones: SesionCard[] = []

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/)
    const h3 = line.match(/^###\s+Sesión\s+(\d+)\s*[—\-]+\s*(.+)/)
    if (h2) {
      if (/sesiones de trabajo/i.test(h2[1])) { inSesiones = true; continue }
      else if (inSesiones) break
    }
    if (!inSesiones) continue
    if (h3) {
      if (current) sesiones.push(current)
      current = { numero: h3[1], titulo: h3[2].trim(), body: '' }
    } else if (current) {
      current.body += line + '\n'
    }
  }
  if (current) sesiones.push(current)
  return sesiones
}

/** Parse also the intro text alongside the sessions */
export function parseSesionesSection(body: string): { intro: string; sesiones: SesionCard[] } {
  const lines = body.split('\n')
  let intro = '', inIntro = true
  let current: SesionCard | null = null
  const sesiones: SesionCard[] = []

  for (const line of lines) {
    const h3 = line.match(/^###\s+Sesión\s+(\d+)\s*[—\-]+\s*(.+)/)
    if (h3) {
      if (current) sesiones.push(current)
      current = { numero: h3[1], titulo: h3[2].trim(), body: '' }
      inIntro = false; continue
    }
    if (inIntro) intro += line + '\n'
    else if (current) current.body += line + '\n'
  }
  if (current) sesiones.push(current)
  return { intro, sesiones }
}

/** Extract all named fields from a session body */
export function parseSesionFields(body: string): SesionFields {
  const FIELDS = [
    { key: 'objetivo',      re: /^\*\*Objetivo\*\*\s*:/         },
    { key: 'prerequisitos', re: /^\*\*Prerequisitos\*\*\s*:/    },
    { key: 'prompt',        re: /^\*\*Prompt de inicio\*\*\s*:/ },
    { key: 'tareas',        re: /^\*\*Tareas\*\*\s*:/           },
    { key: 'validacion',    re: /^\*\*Validación\*\*\s*:/       },
    { key: 'estado',        re: /^\*\*Estado al finalizar\*\*\s*:/ },
  ]
  const result: Record<string, string> = {}
  let currentKey = '', buffer: string[] = []
  const flush = () => { if (currentKey) result[currentKey] = buffer.join('\n').trim() }

  for (const line of body.split('\n')) {
    let matched = false
    for (const { key, re } of FIELDS) {
      if (re.test(line)) {
        flush(); currentKey = key
        buffer = [line.replace(re, '').trim()]
        matched = true; break
      }
    }
    if (!matched && currentKey) buffer.push(line)
  }
  flush()

  const promptClean = (result['prompt'] || '')
    .replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '').trim()

  return {
    objetivo:      result['objetivo']      || '',
    prerequisitos: result['prerequisitos'] || '',
    prompt:        promptClean,
    tareas:        result['tareas']        || '',
    validacion:    result['validacion']    || '',
    estado:        result['estado']        || '',
  }
}

/** Extract the one-liner objetivo from a session body */
export function extractObjetivo(body: string): string {
  const m = body.match(/\*\*Objetivo\*\*\s*:\s*([^\n]+)/)
  return m ? m[1].trim() : ''
}

/** Given a phase name like "Sesión 3 — Flujo A: …", return the session number string ("3") */
export function sesionNumeroFromFase(fase: string): string | null {
  const m = fase.match(/[Ss]esi[oó]n\s+(\d+)/i)
  return m ? m[1] : null
}
