// Extrae texto legible de archivos adjuntos guardados en base64 (hub de leads,
// documentos de propuestas) para dárselo como contexto al asistente de IA.
// Soporta PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx, solo textos) y
// texto plano (txt, md, csv, json, html...). Imágenes y binarios no se leen.
//
// Extraer un PDF de varios MB tarda segundos, y el asistente arma el contexto en
// cada mensaje: por eso hay una caché en memoria por archivo (id + tamaño).

import path from 'path'

const EXT_TEXTO = new Set(['.txt', '.md', '.csv', '.json', '.log', '.html', '.htm', '.xml', '.rtf'])
const EXT_SOPORTADAS = new Set(['.pdf', '.docx', '.pptx', '.xlsx', ...EXT_TEXTO])

const MAX_BYTES = 6 * 1024 * 1024
const TIEMPO_MAX_MS = 12_000
const MAX_CACHE = 200
const cache = new Map<string, string>()

// undefined = no está en caché; null = ya se intentó y no se pudo leer / vacío
export function textoEnCache(clave: string): string | null | undefined {
  const v = cache.get(clave)
  return v === undefined ? undefined : (v || null)
}

export function esLegible(nombre: string): boolean {
  return EXT_SOPORTADAS.has(path.extname(nombre).toLowerCase())
}

function decodificar(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function base64ABuffer(b64: string): Buffer {
  const raw = b64.startsWith('data:') && b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  return Buffer.from(raw, 'base64')
}

async function extraer(buffer: Buffer, ext: string): Promise<string> {
  if (ext === '.pdf') {
    // pdf-parse v2: clase PDFParse (la API de funcion de la v1 ya no existe)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    try { return String((await parser.getText()).text ?? '') } finally { try { await parser.destroy?.() } catch {} }
  }
  if (ext === '.docx') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    return String((await mammoth.extractRawText({ buffer })).value ?? '')
  }
  if (ext === '.pptx' || ext === '.xlsx') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require('jszip')
    const zip = await JSZip.loadAsync(buffer)
    if (ext === '.pptx') {
      const slides = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))
      const partes: string[] = []
      for (const n of slides) {
        const xml: string = await zip.file(n).async('string')
        const textos = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => decodificar(m[1]).trim()).filter(Boolean)
        if (textos.length) partes.push(`Diapositiva ${n.replace(/\D/g, '')}: ${textos.join(' ')}`)
      }
      return partes.join('\n')
    }
    const f = zip.file('xl/sharedStrings.xml')
    if (!f) return ''
    const xml: string = await f.async('string')
    return [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m => decodificar(m[1]).trim()).filter(Boolean).join(' | ')
  }
  let t = buffer.toString('utf-8')
  if (ext === '.html' || ext === '.htm' || ext === '.xml') t = decodificar(t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' '))
  return t
}

// Devuelve el texto (normalizado) o null si el formato no se puede leer / falla / es muy grande.
export async function textoDeArchivo(a: { clave: string; nombre: string; base64: string }): Promise<string | null> {
  const ext = path.extname(a.nombre).toLowerCase()
  if (!EXT_SOPORTADAS.has(ext)) return null
  const hit = cache.get(a.clave)
  if (hit !== undefined) return hit || null
  try {
    const buffer = base64ABuffer(a.base64)
    if (buffer.length > MAX_BYTES) return null
    const texto = await Promise.race([
      extraer(buffer, ext),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('tiempo agotado leyendo el archivo')), TIEMPO_MAX_MS)),
    ])
    const limpio = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20_000)
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
    cache.set(a.clave, limpio)
    return limpio || null
  } catch (e) {
    console.error('[extraerTexto]', a.nombre, e instanceof Error ? e.message : e)
    return null
  }
}

// Igual que textoDeArchivo pero directo desde un Buffer (subidas al proyecto), sin caché.
export async function textoDeBuffer(buffer: Buffer, nombre: string): Promise<string | null> {
  const ext = path.extname(nombre).toLowerCase()
  if (!EXT_SOPORTADAS.has(ext) || buffer.length > MAX_BYTES) return null
  try {
    const texto = await Promise.race([
      extraer(buffer, ext),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('tiempo agotado leyendo el archivo')), TIEMPO_MAX_MS)),
    ])
    const limpio = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    return limpio || null
  } catch (e) {
    console.error('[extraerTexto]', nombre, e instanceof Error ? e.message : e)
    return null
  }
}
