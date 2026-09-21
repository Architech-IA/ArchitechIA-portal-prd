'use client'

import type { ReactNode } from 'react'

// Render mínimo de markdown para las respuestas de la IA: títulos, listas, tablas simples,
// **negrita**, `código` y las citas entre corchetes ([PRD], [Adjunto: x]) como etiquetas.

function inline(t: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]\n]{2,70}\])/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) out.push(t.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(<strong key={`${key}b${i}`} className="text-gray-100 font-semibold">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={`${key}c${i}`} className="px-1 py-0.5 rounded bg-white/10 text-[11px] text-indigo-200">{tok.slice(1, -1)}</code>)
    else out.push(<span key={`${key}k${i}`} className="mx-0.5 px-1.5 py-[1px] rounded-md text-[10px] font-medium align-baseline" style={{ background: 'rgba(99,102,241,0.16)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>{tok.slice(1, -1)}</span>)
    last = m.index + tok.length; i++
  }
  if (last < t.length) out.push(t.slice(last))
  return out
}

export function Md({ texto }: { texto: string }) {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const bloques: ReactNode[] = []
  let i = 0, k = 0
  while (i < lineas.length) {
    const l = lineas[i]
    if (!l.trim()) { i++; continue }

    // Tabla: líneas que empiezan con |
    if (/^\s*\|/.test(l)) {
      const filas: string[][] = []
      while (i < lineas.length && /^\s*\|/.test(lineas[i])) {
        const celdas = lineas[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
        if (!celdas.every(c => /^:?-{2,}:?$/.test(c))) filas.push(celdas)
        i++
      }
      bloques.push(
        <div key={k++} className="my-2 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[11px]">
            <tbody>
              {filas.map((f, fi) => (
                <tr key={fi} className={fi === 0 ? 'bg-white/5 text-gray-200 font-semibold' : 'border-t border-white/5 text-gray-300'}>
                  {f.map((c, ci) => <td key={ci} className="px-2 py-1 align-top">{inline(c, `t${k}${fi}${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>)
      continue
    }

    const h = l.match(/^(#{1,4})\s+(.*)$/)
    if (h) { bloques.push(<p key={k++} className="mt-2 mb-1 text-[12px] font-bold text-gray-100">{inline(h[2], `h${k}`)}</p>); i++; continue }

    if (/^\s*[-*•]\s+/.test(l)) {
      const items: string[] = []
      while (i < lineas.length && /^\s*[-*•]\s+/.test(lineas[i])) { items.push(lineas[i].replace(/^\s*[-*•]\s+/, '')); i++ }
      bloques.push(<ul key={k++} className="my-1 ml-4 list-disc space-y-0.5">{items.map((t, j) => <li key={j}>{inline(t, `u${k}${j}`)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items: string[] = []
      while (i < lineas.length && /^\s*\d+[.)]\s+/.test(lineas[i])) { items.push(lineas[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
      bloques.push(<ol key={k++} className="my-1 ml-4 list-decimal space-y-0.5">{items.map((t, j) => <li key={j}>{inline(t, `o${k}${j}`)}</li>)}</ol>)
      continue
    }
    // Párrafo: junta líneas consecutivas
    const par: string[] = []
    while (i < lineas.length && lineas[i].trim() && !/^\s*([-*•]\s|\d+[.)]\s|\||#{1,4}\s)/.test(lineas[i])) { par.push(lineas[i]); i++ }
    if (par.length === 0) { i++; continue }
    bloques.push(<p key={k++} className="my-1">{inline(par.join(' '), `p${k}`)}</p>)
  }
  return <div className="text-[12px] leading-relaxed text-gray-300 break-words">{bloques}</div>
}

// Opciones numeradas al final de un mensaje (entrevista de Kickoff): 3 o más líneas «N. texto»
export function opcionesNumeradas(texto: string): { prosa: string; opciones: string[] } | null {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const opciones: string[] = []
  let fin = lineas.length
  for (let i = lineas.length - 1; i >= 0; i--) {
    const l = lineas[i].trim()
    if (!l) { if (opciones.length) break; continue }
    const m = l.match(/^(\d+)[.)]\s+(.*)$/)
    if (!m) break
    opciones.unshift(m[2]); fin = i
  }
  if (opciones.length < 3) return null
  return { prosa: lineas.slice(0, fin).join('\n').trim(), opciones }
}
