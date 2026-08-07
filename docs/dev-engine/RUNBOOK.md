# Runbook del Dev Engine

## Arranque completo del sistema

### Orden de arranque

Los servicios tienen dependencias — arrancar en este orden:

```bash
# 1. Redis (Docker) — otros servicios dependen de él
docker start scheduling-redis
docker exec scheduling-redis redis-cli ping   # → PONG

# 2. Servicios pm2
~/.local/share/pnpm/pm2 start vault-api
~/.local/share/pnpm/pm2 start graph-api
~/.local/share/pnpm/pm2 start harness-api
~/.local/share/pnpm/pm2 start portal-architechia

# 3. Verificar todo
~/.local/share/pnpm/pm2 list
curl -s http://localhost:8766/ | python3 -c "import sys,json; d=json.load(sys.stdin); print('Vault:', d.get('status','?'))"
curl -s http://localhost:8765/ | python3 -c "import sys,json; d=json.load(sys.stdin); print('Graph:', d.get('status','?'))"
curl -s http://localhost:8767/ | python3 -c "import sys,json; d=json.load(sys.stdin); print('Harness:', d.get('status','?'))"
```

### Arranque del bot Discord (opcional)

```bash
# Solo si está configurado el token
export DISCORD_BOT_TOKEN=<token>
export DISCORD_GUILD_ID=<guild_id>
export DISCORD_APPROVAL_CHANNEL_ID=<channel_id>
nohup python3 /root/sage_discord.py > /root/logs/discord.log 2>&1 &
```

## Reinicio de un servicio

```bash
# Reiniciar sin perder logs
~/.local/share/pnpm/pm2 restart <nombre>

# Ver logs en tiempo real
~/.local/share/pnpm/pm2 logs <nombre> --lines 50

# Si pm2 no responde (reinicio completo)
~/.local/share/pnpm/pm2 kill
~/.local/share/pnpm/pm2 resurrect   # restaura la config guardada
```

## Apagado ordenado

```bash
# Portal — usar endpoint de shutdown si está disponible
curl -X POST http://localhost:3003/api/shutdown -H "x-api-key: $INTERNAL_API_KEY"

# Servicios pm2
~/.local/share/pnpm/pm2 stop all

# Redis (solo si es necesario reiniciar el contenedor)
docker stop scheduling-redis
```

## Diagnóstico de fallos

### Síntoma: Portal no responde

```bash
# 1. Verificar que el proceso existe
~/.local/share/pnpm/pm2 list | grep portal

# 2. Ver logs de error
~/.local/share/pnpm/pm2 logs portal-architechia --lines 100 --err

# 3. Verificar puerto
ss -tlnp | grep 3003

# 4. Reiniciar
~/.local/share/pnpm/pm2 restart portal-architechia
```

### Síntoma: Redis no responde

```bash
# 1. Verificar contenedor
docker ps | grep scheduling-redis

# 2. Si no está corriendo
docker start scheduling-redis
sleep 2
docker exec scheduling-redis redis-cli ping

# 3. Verificar IP del contenedor (por si cambió)
docker inspect scheduling-redis | python3 -c "
import sys, json
info = json.load(sys.stdin)
ip = info[0]['NetworkSettings']['Networks']['bridge']['IPAddress']
print('IP Redis:', ip)
"
# Actualizar sage_locks.py y harness.py si la IP cambió
```

### Síntoma: Tareas en la DLQ

```bash
# 1. Ver qué hay en la DLQ
curl http://localhost:8767/dlq

# 2. Inspeccionar la tarea fallida
python3 -c "
import redis, json
r = redis.Redis(host='172.18.0.2', port=6379, decode_responses=True)
dlq = r.lrange('harness:dlq', 0, -1)
for item in dlq:
    task = json.loads(item)
    print(task['id'], task['type'], task.get('error',''))
"

# 3. Limpiar la DLQ tras investigar
python3 -c "
import redis
r = redis.Redis(host='172.18.0.2', port=6379, decode_responses=True)
r.delete('harness:dlq')
print('DLQ limpiada')
"
```

### Síntoma: Locks huérfanos (agentes colgados)

```bash
python3 -c "
from sage_locks import scan_locks, scan_deadlocks, cleanup_orphaned_locks
print('Todos los locks:')
for lock in scan_locks():
    print(' ', lock)
print()
print('Locks huérfanos (TTL=-1):')
for orphan in scan_deadlocks():
    print(' ', orphan)
cleanup_orphaned_locks()
print('Limpieza completada')
"
```

### Síntoma: Graphify desactualizado

```bash
# Reindexar todos los repos registrados
python3 -c "
import urllib.request, json
reg_path = '/root/graphify-repos/repos_registry.json'
with open(reg_path) as f:
    repos = json.load(f)
for repo in repos:
    slug = repo['slug']
    req = urllib.request.Request(
        f'http://localhost:8765/reindex/{slug}',
        method='POST'
    )
    with urllib.request.urlopen(req) as resp:
        print(f'{slug}: {resp.read().decode()[:50]}')
"
```

## Actualización del código

```bash
# 1. Pull latest
cd /root/portal-architechia && git pull origin main

# 2. Si hay cambios en Node (package.json)
cd /root/portal-architechia && pnpm install

# 3. Si hay cambios en el schema de Prisma — usar ALTER TABLE, NUNCA force-reset
# Ver decisiones/feedback antes de cualquier cambio de schema

# 4. Reiniciar el portal
~/.local/share/pnpm/pm2 restart portal-architechia

# 5. Para los módulos Python (sage_*.py) no hay proceso a reiniciar
# Se importan directamente — el próximo invoke_claude usará la versión nueva
```

## Backup y recuperación

```bash
# Backup del vault de agentes
tar -czf /tmp/sage-vault-backup-$(date +%Y%m%d).tar.gz /root/sage-vault/

# Backup de la DB del portal (Supabase — no requiere acción local)
# Los datos del portal están en Supabase; ver panel en supabase.com

# Backup de la cola del Harness
cp -r /root/harness-queue /tmp/harness-queue-backup-$(date +%Y%m%d)/
```

## Variables de entorno

Todas las variables están en `/root/portal-architechia/.env` (portal) y en el entorno del shell para los scripts Python.

```bash
# Verificar que las variables críticas están presentes
grep -E "INTERNAL_API_KEY|DATABASE_URL|NEXTAUTH_SECRET" /root/portal-architechia/.env | cut -d= -f1
```

Variables requeridas para el Dev Engine que NO están en `.env` del portal:

```bash
# Estas van en el entorno del shell o en /etc/environment
ANTHROPIC_API_KEY=sk-ant-...       # Claude Code headless
DISCORD_BOT_TOKEN=...               # Bot Discord
DISCORD_GUILD_ID=...               # Servidor Discord
DISCORD_APPROVAL_CHANNEL_ID=...    # Canal de aprobaciones
```
