import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import path from 'path'

export const dynamic = 'force-dynamic'

// Extraccion de texto reutilizada 1:1 de document/process/route.ts — a
// diferencia de esa ruta (que ademas le pide al LLM una propuesta
// estructurada completa), esta solo devuelve el texto crudo: el archivo
// adjuntado en el chat de Kickoff se suma como CONTEXTO a la conversacion
// en curso con Orion, no reemplaza el flujo de extraccion final.
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

  const buffer = Buffer.from(await file.arrayBuffer())

  let text: string
  try {
    text = await extractTextFromBuffer(buffer, file.name)
  } catch (err: any) {
    return NextResponse.json({ error: 'Error extrayendo texto', detail: err.message }, { status: 500 })
  }

  // Mismo tope que document/process (~50 paginas) para no reventar el
  // limite de tokens del modelo dentro de una conversacion que ya viene
  // con historial acumulado.
  const truncated = text.slice(0, 20000)
  return NextResponse.json({ text: truncated, fileName: file.name, truncated: text.length > 20000 })
}
