import { promises as fs } from 'fs'
import path from 'path'

const VAULT_ROOT = process.env.SAGE_VAULT_PATH ?? '/root/sage-vault'

export interface VaultNote {
  frontmatter: Record<string, string | number | string[]>
  body: string
}

function serializeFrontmatter(fm: Record<string, string | number | string[]>): string {
  const lines = Object.entries(fm).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.map(x => `'${x}'`).join(', ')}]`
    return `${k}: ${typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`}`
  })
  return `---\n${lines.join('\n')}\n---\n`
}

function parseFrontmatter(raw: string): VaultNote {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw }
  const fm: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^'|'$/g, '')
  }
  return { frontmatter: fm, body: match[2] }
}

/** Escribe (o sobreescribe) una nota del vault. relPath es relativo a SAGE_VAULT_PATH. */
export async function writeVaultNote(
  relPath: string,
  frontmatter: Record<string, string | number | string[]>,
  body: string
): Promise<string> {
  const fullPath = path.join(VAULT_ROOT, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, serializeFrontmatter(frontmatter) + '\n' + body.trim() + '\n', 'utf8')
  return fullPath
}

/** Lee una nota del vault. Devuelve null si no existe. */
export async function readVaultNote(relPath: string): Promise<VaultNote | null> {
  const fullPath = path.join(VAULT_ROOT, relPath)
  try {
    const raw = await fs.readFile(fullPath, 'utf8')
    return parseFrontmatter(raw)
  } catch {
    return null
  }
}
