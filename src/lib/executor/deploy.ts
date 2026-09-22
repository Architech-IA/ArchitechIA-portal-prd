import { execFile } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { resolveRepoConfig } from './repoConfig'
import { envFileSiExiste, guardarVariableInterna } from './secrets'

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
  // Multi-stage, deliberadamente tolerante con lo que el proyecto traiga configurado.
  // "COPY prisma ./prisma" antes de "npm install": un proyecto con Prisma corre `prisma
  // generate` en su postinstall, que necesita prisma/schema.prisma YA presente en ese paso —
  // sin esto, cualquier proyecto con base de datos (MASD-0023-0006-028) fallaba el build.
  // asegurarCarpetaPrisma() garantiza que la carpeta exista (aunque sea vacía) para que este
  // COPY nunca falle en proyectos sin Prisma.
  // "apk add openssl" en ambas etapas (deps y runner): Alpine no trae libssl visible para que
  // Prisma detecte su versión, así que el motor de Prisma quedaba corriendo con el binario
  // equivocado y fallaba en runtime con "Could not parse schema engine response" — problema
  // conocido de Prisma + Alpine, no específico de este proyecto.
  //
  // MASD-0023-0006-030: si el proyecto tiene "output: 'standalone'" en next.config, Next arma
  // en .next/standalone un build reducido (solo las dependencias de producción que realmente
  // usa, resueltas por trazado) — imagen final mucho más liviana que copiar node_modules
  // completo. El scaffolding del Motor no configura eso por default, y no todos los proyectos
  // desplegados los arma el Motor, así que el Dockerfile no puede asumirlo: la normalización de
  // abajo detecta .next/standalone EN TIEMPO DE BUILD (adentro del contenedor, no en el Node
  // del portal) y arma /salida desde ahí si existe, o cae al modo anterior (node_modules
  // completo) si no — la etapa runner siempre copia desde el mismo /salida sin necesitar saber
  // de antemano qué generó el proyecto. Gotcha conocido de Prisma + standalone: el trazador de
  // Next no siempre detecta el binario del motor de Prisma (se carga dinámicamente, no via
  // require rastreable), así que node_modules/.prisma y @prisma se copian aparte a mano si
  // existen, sin importar el modo.
  const contenido = `FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm run build
RUN mkdir -p /salida && \\
    if [ -d .next/standalone ]; then \\
      cp -r .next/standalone/. /salida/ && \\
      mkdir -p /salida/.next && \\
      cp -r .next/static /salida/.next/static && \\
      cp -r public /salida/public && \\
      echo 'node server.js' > /salida/iniciar.sh; \\
    else \\
      cp -r node_modules /salida/node_modules && \\
      cp -r .next /salida/.next && \\
      cp -r public /salida/public && \\
      cp package.json /salida/package.json && \\
      echo 'npm start' > /salida/iniciar.sh; \\
    fi && \\
    cp -r prisma /salida/prisma && \\
    if [ -d node_modules/.prisma ]; then mkdir -p /salida/node_modules/.prisma && cp -r node_modules/.prisma/. /salida/node_modules/.prisma/; fi && \\
    if [ -d node_modules/@prisma ]; then mkdir -p /salida/node_modules/@prisma && cp -r node_modules/@prisma/. /salida/node_modules/@prisma/; fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache openssl
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /salida ./
USER nextjs
EXPOSE 3000
CMD ["sh", "iniciar.sh"]
`
  fs.writeFileSync(DOCKERFILE_GENERICO, contenido)
}

function asegurarCarpetaPrisma(repoPath: string) {
  fs.mkdirSync(path.join(repoPath, 'prisma'), { recursive: true })
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
  const [sol] = await prisma.$queryRawUnsafe<{ nombre: string; repositorio: string | null; deployContainerName: string | null; dbNetworkName: string | null }[]>(
    `SELECT nombre, repositorio, "deployContainerName", "dbNetworkName" FROM "Solucion" WHERE id = $1`, solucionId)
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
    asegurarCarpetaPrisma(repoPath)
    const slug = slugDeploy(sol.nombre)
    // Tag de imagen ESTABLE por proyecto (habilita la caché de capas de Docker entre deploys
    // sucesivos del mismo proyecto) — el nombre de CONTENEDOR sí es único por intento, para que
    // el nuevo y el viejo puedan convivir mientras se confirma que el nuevo está sano.
    const imagen = `demo-image-${slug}`
    const contenedorNuevo = `demo-${slug}-${Date.now()}`
    const puertoNuevo = await puertoLibre() // ya excluye el puerto que esté usando el contenedor viejo

    await sh('docker', ['build', '-f', DOCKERFILE_GENERICO, '-t', imagen, repoPath], { timeout: 600_000 })
    // Si el proyecto tiene base de datos aprovisionada, el contenedor se une a esa red privada
    // (para resolver el contenedor de Postgres por nombre) además de publicar su puerto para
    // Nginx. Si hay variables de entorno cargadas (incluida DATABASE_URL, que aprovisionarBase-
    // DeDatos ya dejó ahí), se las pasa con --env-file.
    const runArgs = ['run', '-d', '--name', contenedorNuevo, '-p', `${puertoNuevo}:3000`, '--restart', 'unless-stopped']
    if (sol.dbNetworkName) runArgs.push('--network', sol.dbNetworkName)
    const envFile = envFileSiExiste(sol.nombre)
    if (envFile) runArgs.push('--env-file', envFile)
    runArgs.push(imagen)
    await sh('docker', runArgs)
    try {
      await esperarContenedorListo(contenedorNuevo, puertoNuevo)
    } catch (err) {
      // El nuevo nunca llegó a estar sano — se descarta, y el viejo (si había uno) sigue
      // sirviendo tal cual estaba, sin ningún corte.
      await sh('docker', ['rm', '-f', contenedorNuevo]).catch(() => '')
      throw err
    }

    // Recién acá Nginx pasa a apuntar al nuevo — "reload" no corta conexiones ya abiertas.
    try {
      fs.writeFileSync(nginxConfPath(slug), nginxConfHttps(slug, puertoNuevo))
      await sh('nginx', ['-t'])
      await sh('systemctl', ['reload', 'nginx'])
    } catch (err) {
      // Bug real encontrado probando esto: si "nginx -t" falla (ej. un problema de la config
      // global de nginx, no de este proyecto) DESPUÉS de que el contenedor nuevo ya estaba
      // sano, antes esto lo dejaba huérfano — corriendo, con el puerto ocupado para siempre,
      // sin que Nginx jamás llegara a apuntarle. Mismo criterio que el catch de arriba: si
      // Nginx nunca llegó a cambiar, el contenedor nuevo no sirve para nada.
      await sh('docker', ['rm', '-f', contenedorNuevo]).catch(() => '')
      await fs.promises.unlink(nginxConfPath(slug)).catch(() => {})
      throw err
    }

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

// ─────────────────────────── Base de datos por proyecto ───────────────────────────
// MASD-0023-0006 (base de datos + variables de entorno). Un Postgres dedicado por proyecto —
// mismo patrón que ya usa este VPS para otros clientes (portal-seg-postgres, smartlex-db):
// contenedor propio, volumen propio (sobrevive a cada redeploy de la app, que solo reemplaza el
// contenedor de la app), y SIN puerto publicado al host — solo alcanzable desde el contenedor
// de la app, por una red de Docker privada creada para este proyecto. Ni internet ni otro
// proyecto desplegado pueden llegar a esta base de datos directamente.
//
// Disparo: botón «Agregar base de datos» aparte de «Publicar» — no todos los proyectos la
// necesitan, y aprovisionar de más gastaría recursos del VPS sin necesidad.

export interface ResultadoDB { contenedor: string; red: string; volumen: string }

async function dockerNetworkAsegurar(nombre: string): Promise<void> {
  const existe = await sh('docker', ['network', 'ls', '--filter', `name=^${nombre}$`, '--format', '{{.Name}}']).catch(() => '')
  if (!existe.trim()) await sh('docker', ['network', 'create', nombre])
}

async function esperarPostgresListo(contenedor: string, usuario: string, intentos = 20): Promise<void> {
  for (let i = 0; i < intentos; i++) {
    try {
      await sh('docker', ['exec', contenedor, 'pg_isready', '-U', usuario])
      return
    } catch {
      const estado = await sh('docker', ['inspect', '-f', '{{.State.Status}}', contenedor]).catch(() => '?')
      if (estado.trim() === 'exited') {
        const logs = await sh('docker', ['logs', '--tail', '30', contenedor]).catch(() => '')
        throw new Error(`El contenedor de la base de datos se cerró solo antes de estar listo.\n${logs.slice(-1500)}`)
      }
      await new Promise(r => setTimeout(r, 1500))
    }
  }
  throw new Error(`La base de datos no respondió después de ${intentos * 1.5}s.`)
}

export async function aprovisionarBaseDeDatos(solucionId: string): Promise<ResultadoDB> {
  const [sol] = await prisma.$queryRawUnsafe<{ nombre: string; dbContainerName: string | null }[]>(
    `SELECT nombre, "dbContainerName" FROM "Solucion" WHERE id = $1`, solucionId)
  if (!sol) throw new Error('La Solución no existe.')
  if (sol.dbContainerName) throw new Error('Este proyecto ya tiene una base de datos aprovisionada.')

  const slug = slugDeploy(sol.nombre)
  const red = `demo-net-${slug}`
  const volumen = `demo-db-${slug}`
  const contenedor = `demo-db-${slug}`
  const dbNombre = slug.replace(/-/g, '_')
  const usuario = 'app'
  const clave = crypto.randomBytes(24).toString('base64url')

  await prisma.$executeRawUnsafe(`UPDATE "Solucion" SET "dbStatus"='PROVISIONING', "updatedAt"=NOW() WHERE id=$1`, solucionId)
  try {
    await dockerNetworkAsegurar(red)
    await sh('docker', ['volume', 'create', volumen]).catch(() => '')
    await sh('docker', [
      'run', '-d', '--name', contenedor, '--network', red,
      '-e', `POSTGRES_PASSWORD=${clave}`, '-e', `POSTGRES_DB=${dbNombre}`, '-e', `POSTGRES_USER=${usuario}`,
      '-v', `${volumen}:/var/lib/postgresql/data`, '--restart', 'unless-stopped', 'postgres:16-alpine',
    ])
    await esperarPostgresListo(contenedor, usuario)

    // DATABASE_URL queda en el archivo de variables del proyecto, nunca en la base de datos del
    // portal — mismo criterio de MASD-0023-0006-028. El host es el NOMBRE del contenedor: Docker
    // lo resuelve solo dentro de esta red, no hace falta IP fija.
    guardarVariableInterna(sol.nombre, 'DATABASE_URL', `postgresql://${usuario}:${clave}@${contenedor}:5432/${dbNombre}`)

    await prisma.$executeRawUnsafe(
      `UPDATE "Solucion" SET "dbContainerName"=$1, "dbNetworkName"=$2, "dbVolumeName"=$3, "dbStatus"='READY', "dbProvisionedAt"=NOW(), "updatedAt"=NOW() WHERE id=$4`,
      contenedor, red, volumen, solucionId)
    return { contenedor, red, volumen }
  } catch (err) {
    await prisma.$executeRawUnsafe(`UPDATE "Solucion" SET "dbStatus"='FAILED', "updatedAt"=NOW() WHERE id=$1`, solucionId)
    throw err
  }
}

// ─────────────────────────── Migraciones ───────────────────────────
// Manual, aparte de «Publicar» — a propósito (decisión explícita del usuario): una migración
// mal escrita podría alterar o borrar datos reales sin revisión si corriera sola en cada
// despliegue. Corre "prisma migrate deploy" DENTRO de un contenedor descartable, en la misma
// red privada que la base de datos, usando la imagen ya construida del proyecto (o construye
// una si todavía no existe ninguna).

export interface ResultadoMigracion { ok: boolean; salida: string }

export async function aplicarMigraciones(solucionId: string): Promise<ResultadoMigracion> {
  const [sol] = await prisma.$queryRawUnsafe<{ nombre: string; repositorio: string | null; dbNetworkName: string | null }[]>(
    `SELECT nombre, repositorio, "dbNetworkName" FROM "Solucion" WHERE id = $1`, solucionId)
  if (!sol) throw new Error('La Solución no existe.')
  if (!sol.repositorio) throw new Error('Esta Solución no tiene repositorio asociado.')
  if (!sol.dbNetworkName) throw new Error('Este proyecto todavía no tiene una base de datos aprovisionada — agregala primero.')

  const { repoPath } = await resolveRepoConfig(solucionId)
  await sh('git', ['fetch', 'origin', 'main'], { cwd: repoPath })
  await sh('git', ['checkout', 'main'], { cwd: repoPath })
  await sh('git', ['reset', '--hard', 'origin/main'], { cwd: repoPath })

  if (!fs.existsSync(path.join(repoPath, 'prisma', 'schema.prisma'))) {
    throw new Error('Este proyecto no tiene prisma/schema.prisma — no hay migraciones de Prisma que aplicar.')
  }

  const slug = slugDeploy(sol.nombre)
  const imagen = `demo-image-${slug}`
  const yaHayImagen = await sh('docker', ['image', 'inspect', imagen]).then(() => true).catch(() => false)
  if (!yaHayImagen) {
    asegurarDockerfileGenerico()
    asegurarCarpetaPrisma(repoPath)
    await sh('docker', ['build', '-f', DOCKERFILE_GENERICO, '-t', imagen, repoPath], { timeout: 600_000 })
  }

  // "--user root": la imagen de runtime corre como el usuario no-root "nextjs" (node_modules
  // quedó root-owned al copiarse en el build), pero prisma CLI necesita escribir binarios de
  // motor en node_modules/@prisma/engines — sin esto, migrate deploy fallaba siempre con
  // "Can't write to ... please make sure you install prisma with the right permissions".
  // Seguro acá porque este contenedor es efímero (--rm), sin puerto publicado y en una red
  // privada — no es el proceso de la app que queda corriendo.
  const envFile = envFileSiExiste(sol.nombre)
  const args = ['run', '--rm', '--user', 'root', '--network', sol.dbNetworkName]
  if (envFile) args.push('--env-file', envFile)
  args.push(imagen, 'npx', 'prisma', 'migrate', 'deploy')

  try {
    const salida = await sh('docker', args, { timeout: 180_000 })
    return { ok: true, salida: salida.slice(-4000) }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, salida: ((e.stdout ?? '') + '\n' + (e.stderr ?? e.message ?? '')).slice(-4000) }
  }
}
