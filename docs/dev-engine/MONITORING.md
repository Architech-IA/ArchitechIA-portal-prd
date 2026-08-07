# Guía de Monitoreo del Dev Engine

## Panel de estado rápido

```bash
# Una línea que muestra el estado de todos los servicios
echo "=== SAGE Dev Engine Status ===" && \
  echo "Redis:" $(docker exec scheduling-redis redis-cli ping 2>/dev/null || echo "DOWN") && \
  for svc in vault-api graph-api harness-api portal-architechia; do
    status=$(~/.local/share/pnpm/pm2 jlist 2>/dev/null | python3 -c "
import sys,json
procs = json.load(sys.stdin)
for p in procs:
  if p['name'] == '$svc':
    print(p['pm2_env']['status'].upper())
    break
else:
  print('NOT_FOUND')
" 2>/dev/null || echo "pm2_error")
    echo "$svc: $status"
  done
```

## Monitoreo via pm2

```bash
# Ver todos los procesos con CPU y memoria
~/.local/share/pnpm/pm2 list

# Monitoreo en tiempo real (TUI)
~/.local/share/pnpm/pm2 monit

# Logs de un servicio
~/.local/share/pnpm/pm2 logs vault-api --lines 50
~/.local/share/pnpm/pm2 logs harness-api --lines 50

# Logs de error solamente
~/.local/share/pnpm/pm2 logs portal-architechia --err --lines 100
```

## Endpoints de salud

| Servicio | Health check | Respuesta esperada |
|----------|-------------|-------------------|
| Vault API | `GET :8766/` | `{"status":"ok","agents":[...]}` |
| Graph API | `GET :8765/` | `{"status":"ok","repos":[...]}` |
| Harness API | `GET :8767/` | `{"status":"ok","queues":{...}}` |
| Portal | `GET :3003/api/health` | `{"ok":true}` |

```bash
# Script de health check completo
for url in \
  "http://localhost:8766/" \
  "http://localhost:8765/" \
  "http://localhost:8767/" \
  "http://localhost:3003/api/health"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  echo "$url → HTTP $code"
done
```

## Monitoreo del Harness

```bash
# Estado de todas las colas
curl -s http://localhost:8767/ | python3 -m json.tool

# Tareas pendientes por agente
for agent in ares atlas iris orion vesta; do
  count=$(curl -s http://localhost:8767/queue/$agent | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tasks',[])))" 2>/dev/null)
  echo "$agent: $count tareas pendientes"
done

# Dead Letter Queue
curl -s http://localhost:8767/dlq | python3 -c "
import sys,json
d = json.load(sys.stdin)
tasks = d.get('tasks', [])
print(f'DLQ: {len(tasks)} tareas')
for t in tasks:
  print(f'  {t[\"id\"][:8]} | {t[\"type\"]} | {t.get(\"error\",\"\")[:60]}')
"
```

## Monitoreo de Redis

```bash
# Conexión y ping
docker exec scheduling-redis redis-cli ping

# Todas las keys del sistema SAGE
docker exec scheduling-redis redis-cli keys "harness:*" | sort
docker exec scheduling-redis redis-cli keys "sage:*" | sort

# Tamaño de las colas
docker exec scheduling-redis redis-cli llen "harness:queue:HIGH"
docker exec scheduling-redis redis-cli llen "harness:queue:MEDIUM"
docker exec scheduling-redis redis-cli llen "harness:queue:LOW"
docker exec scheduling-redis redis-cli llen "harness:dlq"

# Locks activos
docker exec scheduling-redis redis-cli keys "sage:lock:*"

# Info general de Redis
docker exec scheduling-redis redis-cli info memory | grep used_memory_human
docker exec scheduling-redis redis-cli info clients | grep connected_clients
```

## Monitoreo del portal

```bash
# Total de items en el backlog
curl -s http://localhost:3003/api/backlog \
  -H "x-api-key: $(grep INTERNAL_API_KEY /root/portal-architechia/.env | cut -d= -f2)" | \
  python3 -c "import sys,json; items=json.load(sys.stdin); print(f'Total items: {len(items)}')"

# Sprints activos
curl -s http://localhost:3003/api/backlog/sprints \
  -H "x-api-key: $(grep INTERNAL_API_KEY /root/portal-architechia/.env | cut -d= -f2)" | \
  python3 -c "
import sys,json
sprints=json.load(sys.stdin)
active=[s for s in sprints if s.get('status')=='IN_PROGRESS']
print(f'Sprints activos: {len(active)}')
for s in active:
  print(f'  {s[\"sprintCode\"]} — {s[\"name\"]}')
"
```

## Alertas manuales

Señales que requieren atención:

| Señal | Umbral | Acción |
|-------|--------|--------|
| DLQ no vacía | > 0 tareas | Investigar error, limpiar DLQ |
| pm2 restart count | > 5 reinicios | Ver logs, buscar error recurrente |
| Redis keys sage:lock:* | Locks > 30min | Correr `cleanup_orphaned_locks()` |
| Harness queue HIGH | > 20 tareas | El agente puede estar colgado |
| Portal HTTP ≠ 200 | Cualquier fallo | Reiniciar `portal-architechia` |

## Logs del sistema

| Servicio | Ubicación |
|----------|-----------|
| pm2 stdout | `~/.pm2/logs/<nombre>-out.log` |
| pm2 stderr | `~/.pm2/logs/<nombre>-error.log` |
| Executor logs | `/root/sage-vault/agents/<slug>/logs/YYYY-MM-DD.md` |
| Discord bot | `/root/logs/discord.log` (si arrancado con nohup) |

```bash
# Ver logs de ejecución del agente Atlas hoy
cat /root/sage-vault/agents/atlas/logs/$(date +%Y-%m-%d).md 2>/dev/null || echo "Sin logs hoy"

# Ver todos los logs de ejecución de esta semana
find /root/sage-vault/agents -name "*.md" -path "*/logs/*" -newer /root/sage-vault/agents/atlas/logs/ | sort
```

## Reporte de sprint via CLI

```bash
# Reporte en markdown
python3 /root/sage_reporter.py

# Reporte en JSON
python3 /root/sage_reporter.py --json | python3 -m json.tool
```
