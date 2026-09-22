import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { resolveRepoConfig } from './repoConfig'

const execFileAsync = promisify(execFile)

// Despliegue de un proyecto a una URL real: build de imagen Docker + contenedor + server block
// de Nginx bajo *.demos.architechia.co. Corre COMPLETO en el lado Node (root, de confianza) —
// nunca dentro del sandbox de run_command. Es intencional: el token de DNS/el acceso a Docker y
// Nginx del propio VPS de producción no deben estar jamás al alcance de una tarea de código
// arbitraria, por más restringida que esté (ver MASD-0023-0012/0013, aislamiento del worker).
//
// Disparo: manual, botón «Publicar» en el panel Ejecución de Proyectos, después de que la
// persona ya revisó y mergeó el PR del sprint a main — nunca automático. Mismo criterio que
// «nunca se mergea solo a main» que ya regía el resto del Motor.

const DEPLOYS_DIR = '/root/deploys'
const DOMAIN_SUFFIX = 'demos.architechia.co'
const PORT_RANGE_START = 4100
const PORT_RANGE_END = 4199
const DOCKERFILE_GENERICO = path.join(DEPLOYS_DIR, '_Dockerfile.generic-nextjs')

async function sh(cmd: string, args: string[], opts: { cwd?: string; timeout?: number } = {}): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args, { timeout: opts.timeout ?? 300_000, maxBuffer: 20 * 1024 * 1024, cwd: opts.cwd })
  return stdout
}

export function slugDeploy(texto: string): string {
  const s = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return (s || 'proyecto').slice(0, 40)
}

async function puertoLibre(): Promise<number> {
  const usados = await prisma.$queryRawUnsafe<{ deployPort: number }[]>(
    `SELECT "deployPort" FROM "Solucion" WHERE "deployPort" IS NOT NULL`)
  const ocupados = new Set(usados.map(u => u.deployPort))
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) if (!ocupados.has(p)) return p
  throw new Error('No hay puertos libres en el rango de despliegues (4100-4199).')
}

function asegurarDockerfileGenerico() {
  fs.mkdirSync(DEPLOYS_DIR, { recursive: true })
  if (fs.existsSync(DOCKERFILE_GENERICO)) return
  // Multi-stage, deliberadamente simple y tolerante: no asume next.config con output:"standalone"
  // (el scaffolding del Motor no lo configura), así que copia node_modules completo en vez de
  // depender del build standalone de Next — más pesado, pero funciona con cualquier proyecto
  // que el Motor haya armado con create-next-app tal cual, sin retocar la config.
  const contenido = `FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
`
  fs.writeFileSync(DOCKERFILE_GENERICO, contenido)
}

function nginxConfPath(slug: string) { return `/etc/nginx/sites-enabled/demo-${slug}` }

// Certificado wildcard real de *.demos.architechia.co (MASD-0023-0014, GoDaddy + certbot-dns-
// godaddy, renovación automática ya configurada por certbot). Mismo estilo que los demás sitios
// del VPS (ver /etc/nginx/sites-enabled/smartlex) — HTTP redirige a HTTPS.
function nginxConfHttps(slug: string, puerto: number): string {
  const host = `${slug}.${DOMAIN_SUFFIX}`
  return `server {
    listen 80;
    server_name ${host};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${host};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN_SUFFIX}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_SUFFIX}/privkey.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:${puerto};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }
}
`
}

// Espera a que el contenedor recién levantado responda de verdad antes de configurar Nginx y
// marcar el despliegue como LIVE — next start tarda unos segundos en arrancar adentro del
// contenedor; sin esto, un chequeo inmediato después de "docker run -d" da 502 aunque el
// despliegue en sí haya salido bien (visto en la prueba real de MASD-0023-0014).
async function esperarContenedorListo(contenedor: string, puerto: number, intentos = 15): Promise<void> {
  for (let i = 0; i < intentos; i++) {
    try {
      await sh('curl', ['-sf', '-o', '/dev/null', '-m', '3', `http://localhost:${puerto}/`])
      return
    } catch {
      const estado = await sh('docker', ['inspect', '-f', '{{.State.Status}}', contenedor]).catch(() => '?')
      if (estado.trim() === 'exited') {
        const logs = await sh('docker', ['logs', '--tail', '30', contenedor]).catch(() => '')
        throw new Error(`El contenedor se cerró solo antes de responder.\n${logs.slice(-1500)}`)
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw new Error(`El contenedor no respondió en el puerto ${puerto} después de ${intentos * 2}s.`)
}

export interface ResultadoDeploy { url: string; puerto: number; contenedor: string; slug: string }

// Redeploy sin downtime (MASD-0023-0006-029): el contenedor NUEVO se levanta en un puerto
// aparte y se confirma sano ANTES de que Nginx deje de apuntar al viejo — el "reload" de Nginx
// no corta conexiones en curso, así que el corte real es cero. El contenedor viejo recién se
// baja al final, cuando el nuevo ya está confirmado y sirviendo. Beneficio extra sobre el
// esquema anterior (que hacía "docker rm -f" del viejo ANTES de levantar el nuevo): si el
// build o el arranque del nuevo fallan, el viejo sigue funcionando en vez de quedar todo caído.
export async function desplegarSolucion(solucionId: string): Promise<ResultadoDeploy> {
  const [sol] = await prisma.$queryRawUnsafe<{ nombre: string; repositorio: string | null; deployContainerName: string | null }[]>(
    `SELECT nombre, repositorio, "deployContainerName" FROM "Solucion" WHERE id = $1`, solucionId)
  if (!sol) throw new Error('La Solución no existe.')
  if (!sol.repositorio) throw new Error('Esta Solución no tiene repositorio asociado — no hay nada que desplegar.')

  const contenedorViejo = sol.deployContainerName // null si es el primer despliegue

  await prisma.$executeRawUnsafe(`UPDATE "Solucion" SET "deployStatus"='DEPLOYING', "updatedAt"=NOW() WHERE id=$1`, solucionId)
  try {
    const { repoPath } = await resolveRepoConfig(solucionId)
    // Pull de la última main real — el despliegue siempre parte de lo que ya está mergeado y
    // revisado, nunca de una rama de tarea o de sprint sin mergear.
    await sh('git', ['fetch', 'origin', 'main'], { cwd: repoPath })
    await sh('git', ['checkout', 'main'], { cwd: repoPath })
    await sh('git', ['reset', '--hard', 'origin/main'], { cwd: repoPath })

    asegurarDockerfileGenerico()
    const slug = slugDeploy(sol.nombre)
    // Tag de imagen ESTABLE por proyecto (habilita la caché de capas de Docker entre deploys
    // sucesivos del mismo proyecto) — el nombre de CONTENEDOR sí es único por intento, para que
    // el nuevo y el viejo puedan convivir mientras se confirma que el nuevo está sano.
    const imagen = `demo-image-${slug}`
    const contenedorNuevo = `demo-${slug}-${Date.now()}`
    const puertoNuevo = await puertoLibre() // ya excluye el puerto que esté usando el contenedor viejo

    await sh('docker', ['build', '-f', DOCKERFILE_GENERICO, '-t', imagen, repoPath], { timeout: 600_000 })
    await sh('docker', ['run', '-d', '--name', contenedorNuevo, '-p', `${puertoNuevo}:3000`, '--restart', 'unless-stopped', imagen])
    try {
      await esperarContenedorListo(contenedorNuevo, puertoNuevo)
    } catch (err) {
      // El nuevo nunca llegó a estar sano — se descarta, y el viejo (si había uno) sigue
      // sirviendo tal cual estaba, sin ningún corte.
      await sh('docker', ['rm', '-f', contenedorNuevo]).catch(() => '')
      throw err
    }

    // Recién acá Nginx pasa a apuntar al nuevo — "reload" no corta conexiones ya abiertas.
    fs.writeFileSync(nginxConfPath(slug), nginxConfHttps(slug, puertoNuevo))
    await sh('nginx', ['-t'])
    await sh('systemctl', ['reload', 'nginx'])

    // El viejo se baja al final, cuando el nuevo ya está confirmado y Nginx ya cambió.
    if (contenedorViejo) await sh('docker', ['rm', '-f', contenedorViejo]).catch(() => '')

    const url = `https://${slug}.${DOMAIN_SUFFIX}`
    await prisma.$executeRawUnsafe(
      `UPDATE "Solucion" SET "deployUrl"=$1, "deployPort"=$2, "deployContainerName"=$3, "deployStatus"='LIVE', "deployedAt"=NOW(), "updatedAt"=NOW() WHERE id=$4`,
      url, puertoNuevo, contenedorNuevo, solucionId)
    return { url, puerto: puertoNuevo, contenedor: contenedorNuevo, slug }
  } catch (err) {
    // Si había un despliegue previo sano y este intento falló, el estado real sigue siendo
    // "LIVE" (el viejo sigue corriendo) — FAILED acá sería mentir sobre el estado real. Solo se
    // marca FAILED si este era el primer despliegue (no había nada corriendo antes).
    await prisma.$executeRawUnsafe(
      `UPDATE "Solucion" SET "deployStatus"=$1, "updatedAt"=NOW() WHERE id=$2`,
      contenedorViejo ? 'LIVE' : 'FAILED', solucionId)
    throw err
  }
}
