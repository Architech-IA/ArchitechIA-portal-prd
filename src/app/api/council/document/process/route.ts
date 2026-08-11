import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

const EXTRACT_SYSTEM = `Eres Orión, extractor estructurado de propuestas para el consejo de ArchiTechIA.

Tu tarea: analizar el contenido de un documento que un socio ha subido, y extraer una propuesta formal con el siguiente formato JSON EXACTO (sin markdown, sin explicaciones):

{
  "title": "título conciso de la propuesta (max 80 chars)",
  "description": "descripción ejecutiva de 2-3 oraciones explicando el por qué y el objetivo",
  "items": [
    {
      "type": "task" o "sprint",
      "title": "título del item",
      "description": "qué implica este item",
      "areaSlug": "slug del área propietaria (operations/sales/finance/marketing/people/delivery/dev/data/infra/security/qa)",
      "priority": "LOW" o "MEDIUM" o "HIGH" o "CRITICAL"
    }
  ]
}

Si el documento no es suficientemente claro, extrae al menos 1 task genérica. Responde SOLO con el JSON.`

async function extractTextFromBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const ext = path.extname(fileName).toLowerCase()

  if (ext === '.pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text
  }

  if (ext === '.docx') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // TXT and fallback
  return buffer.toString('utf-8')
}

export async function POST(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const allowed = ['.pdf', '.docx', '.txt']
  const ext = path.extname(file.name).toLowerCase()
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: `Tipo no soportado. Use: ${allowed.join(', ')}` }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Save temp file
  const tmpDir = '/tmp/council-docs'
  await mkdir(tmpDir, { recursive: true })
  const tmpPath = path.join(tmpDir, `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
  await writeFile(tmpPath, buffer)

  let text: string
  try {
    text = await extractTextFromBuffer(buffer, file.name)
  } catch (err: any) {
    return NextResponse.json({ error: 'Error extrayendo texto', detail: err.message }, { status: 500 })
  }

  // Truncate to ~20k chars to avoid LLM token limits (≈50 pages)
  const truncated = text.slice(0, 20000)

  const userPrompt = `El siguiente es el contenido de un documento llamado "${file.name}":\n\n${truncated}\n\nExtrae la propuesta formal en JSON.`
  const safeSystem = EXTRACT_SYSTEM.replace(/'/g, "'\\''")
  const safeUser = userPrompt.replace(/'/g, "'\\''")

  try {
    const { stdout } = await execAsync(`claude --system-prompt '${safeSystem}' -p '${safeUser}'`, { timeout: 90000 })
    const raw = stdout.trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Orión no pudo extraer propuesta', raw }, { status: 422 })

    const proposal = JSON.parse(match[0])
    return NextResponse.json({ ...proposal, _sourceFile: file.name })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error llamando LLM', detail: err.message }, { status: 500 })
  }
}
