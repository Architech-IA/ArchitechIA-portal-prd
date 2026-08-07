# ArchiTechIA Dev Engine (ADE)

Sistema multi-agente de IA que ejecuta tareas de desarrollo de forma autónoma sobre repositorios reales.

## Qué es

El Dev Engine es la capa de ejecución de los agentes SAGE. Permite que agentes de IA (Ares, Atlas, Iris, Orion, Vesta) lean tareas del backlog del portal, las ejecuten usando Claude Code en modo headless, y reporten los resultados — todo sin intervención humana salvo en tareas de alto riesgo.

## Componentes

```
Portal ArchiTechIA  ←→  sage_portal_bridge.py   (Bridge HTTP)
         ↓
    Harness (harness.py + harness_api.py)         (Cola de tareas)
         ↓
    Executor (sage_executor.py)                   (Invoca Claude Code)
         ↓
    Claude Code CLI  ←→  ContextBuilder           (LLM + contexto)
         ↓
    Vault (vault_api.py + sage_memory.py)         (Memoria de agentes)
    Graphify (graph_api.py)                       (Grafo de código)
    Locks (sage_locks.py)                         (Coordinación)
         ↓
    Discord (sage_discord.py)                     (Interfaz humana)
    Approval (sage_approval.py)                   (Human-in-the-loop)
    Reporter (sage_reporter.py)                   (Reportes de avance)
```

## Servicios en el VPS (177.7.46.87)

| Servicio        | Puerto | pm2 ID | Descripción                        |
|-----------------|--------|--------|------------------------------------|
| graph-api       | 8765   | 3      | Knowledge Graph multi-repo         |
| vault-api       | 8766   | 4      | Vault Obsidian REST API            |
| harness-api     | 8767   | 5      | Monitor de colas del Harness       |
| portal-architechia | 3003 | 2    | Portal Next.js                     |
| scheduling-redis | 6379  | —      | Docker: `scheduling-redis`         |

## Arranque rápido

```bash
# Ver estado de todos los servicios
~/.local/share/pnpm/pm2 list

# Arrancar un servicio específico
~/.local/share/pnpm/pm2 start graph-api
~/.local/share/pnpm/pm2 start vault-api
~/.local/share/pnpm/pm2 start harness-api

# Verificar Redis (Docker)
docker exec scheduling-redis redis-cli ping  # → PONG

# Verificar Harness
curl http://localhost:8767/

# Verificar Vault
curl http://localhost:8766/

# Iniciar bot Discord (una vez configurado el token)
export DISCORD_BOT_TOKEN=...
export DISCORD_GUILD_ID=...
export DISCORD_APPROVAL_CHANNEL_ID=...
python3 /root/sage_discord.py
```

## Variables de entorno requeridas

```bash
ANTHROPIC_API_KEY=sk-ant-...          # Para Claude Code headless
DISCORD_BOT_TOKEN=...                 # Bot Discord SAGE
DISCORD_GUILD_ID=...                  # ID del servidor Discord
DISCORD_APPROVAL_CHANNEL_ID=...      # Canal para notificaciones de aprobación
PORTAL_API_KEY=...                    # = INTERNAL_API_KEY del portal
```

## Módulos Python

| Archivo               | Descripción                                      |
|-----------------------|--------------------------------------------------|
| `harness.py`          | Cola de tareas (Redis + JSON fallback)           |
| `harness_api.py`      | API REST de monitoreo del Harness                |
| `sage_executor.py`    | Wrapper headless de Claude Code + ContextBuilder |
| `sage_memory.py`      | VaultClient SDK para leer/escribir el vault      |
| `sage_locks.py`       | Locks distribuidos y canal pub/sub Redis         |
| `sage_portal_bridge.py` | Cliente HTTP del portal ArchiTechIA            |
| `sage_discord.py`     | Bot Discord con router multiagente               |
| `sage_approval.py`    | Human-in-the-loop: aprobación de tareas          |
| `sage_reporter.py`    | Generación de reportes de avance del sprint      |
| `graph_api.py`        | Knowledge Graph API (Graphify multi-repo)        |
| `vault_api.py`        | Vault REST API (Obsidian-compatible)             |
