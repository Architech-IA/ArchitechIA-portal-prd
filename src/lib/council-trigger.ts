import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)
const CONFIG_PATH = path.join(process.cwd(), 'council-trigger-config.json')

export interface TriggerConfig {
  PRODUCT: boolean
  PROJECT: boolean
  INTERN: boolean
  PILOT: boolean
  epicTriggerEnabled: boolean
}

const DEFAULT_CONFIG: TriggerConfig = {
  PRODUCT: true,
  PROJECT: true,
  INTERN: false,
  PILOT: false,
  epicTriggerEnabled: true,
}

export async function getTriggerConfig(): Promise<TriggerConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveTriggerConfig(config: TriggerConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

const ORION_SYSTEM = `Eres Orión, agente estratégico de ArchiTechIA. Tu función en este canal es analizar nuevas soluciones y épicas recién creadas y proponer automáticamente un set inicial de épicas/sprints/tasks para que el consejo los valide antes de agregarlos al backlog.

Responde SIEMPRE con JSON EXACTO sin markdown ni explicaciones:
{
  "title": "título de la propuesta (max 80 chars)",
  "description": "descripción ejecutiva de 2-3 oraciones explicando el por qué y objetivo",
  "items": [
    {
      "type": "task" o "sprint" o "epic",
      "title": "título del item",
      "description": "qué implica este item",
      "areaSlug": "operations/sales/finance/marketing/people/delivery/dev/data/infra/security/qa",
      "priority": "LOW" o "MEDIUM" o "HIGH" o "CRITICAL"
    }
  ]
}`

async function callOrion(userPrompt: string): Promise<{ title: string; description: string; items: any[] } | null> {
  const safeSystem = ORION_SYSTEM.replace(/'/g, "'\\''")
  const safeUser = userPrompt.replace(/'/g, "'\\''")
  try {
    const { stdout } = await execAsync(`claude --system-prompt '${safeSystem}' -p '${safeUser}'`, { timeout: 90000 })
    const match = stdout.trim().match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

const TIPO_LABEL: Record<string, string> = {
  PRODUCT: 'producto comercial para clientes externos',
  PROJECT: 'proyecto para un cliente específico',
  INTERN: 'herramienta o plataforma interna de ArchiTechIA',
  PILOT: 'piloto experimental o prueba de concepto',
}

export async function triggerSolutionProposal(solucion: {
  id: string; nombre: string; descripcion: string | null; tipo: string
}): Promise<void> {
  const config = await getTriggerConfig()
  if (!config[solucion.tipo as keyof TriggerConfig]) return

  const userPrompt = `Se acaba de crear una nueva solución en ArchiTechIA.

Nombre: "${solucion.nombre}"
Tipo: ${solucion.tipo} — ${TIPO_LABEL[solucion.tipo] ?? solucion.tipo}
Descripción: ${solucion.descripcion ?? '(sin descripción)'}

Propone un roadmap inicial para esta solución: épicas de alto nivel o sprints iniciales con las tareas más críticas para arrancar. El consejo validará antes de agregarlo al backlog.`

  const extracted = await callOrion(userPrompt)
  if (!extracted) return

  const { prisma } = await import('./prisma')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CouncilProposal" (id, title, description, status, "inputChannel", items, round, metadata, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, 'PENDING', 'INTERNAL_TRIGGER', $3::jsonb, 1, $4::jsonb, NOW(), NOW())`,
    extracted.title ?? `Propuesta inicial: ${solucion.nombre}`,
    extracted.description ?? '',
    JSON.stringify(extracted.items ?? []),
    JSON.stringify({ trigger: 'solution_created', solucionId: solucion.id, solucionNombre: solucion.nombre, tipo: solucion.tipo })
  )
}

export async function triggerEpicProposal(epic: {
  id: string; name: string; description: string | null
  solucionId: string | null; solucionNombre?: string; existingEpics?: string[]
}): Promise<void> {
  const config = await getTriggerConfig()
  if (!config.epicTriggerEnabled) return

  const userPrompt = `Se acaba de crear una nueva épica en ArchiTechIA.

Épica: "${epic.name}"
Descripción: ${epic.description ?? '(sin descripción)'}
Solución: ${epic.solucionNombre ?? 'no especificada'}${epic.existingEpics && epic.existingEpics.length > 0 ? `\nOtras épicas en esta solución: ${epic.existingEpics.join(', ')}` : ''}

Propone sprints que descompongan el trabajo de esta épica en iteraciones de 2 semanas. Cada sprint incluye tasks concretas con área responsable. Considera las otras épicas para evitar solapamientos.`

  const extracted = await callOrion(userPrompt)
  if (!extracted) return

  const { prisma } = await import('./prisma')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CouncilProposal" (id, title, description, status, "inputChannel", items, round, metadata, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, 'PENDING', 'INTERNAL_TRIGGER', $3::jsonb, 1, $4::jsonb, NOW(), NOW())`,
    extracted.title ?? `Descomposición: ${epic.name}`,
    extracted.description ?? '',
    JSON.stringify(extracted.items ?? []),
    JSON.stringify({ trigger: 'epic_created', epicId: epic.id, epicNombre: epic.name, solucionId: epic.solucionId })
  )
}
