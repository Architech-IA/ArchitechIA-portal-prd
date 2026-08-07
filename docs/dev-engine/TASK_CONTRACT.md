# Contrato de Tarea del Harness

Define el esquema completo de una `Task` que circula por el sistema SAGE.

## Estructura JSON

```json
{
  "id": "uuid-v4",
  "type": "code_review",
  "agent": "atlas",
  "priority": "HIGH",
  "payload": {
    "prompt": "Texto del prompt para Claude Code",
    "repo_path": "/root/portal-architechia",
    "context_files": ["/root/sage_executor.py"],
    "requires_approval": false
  },
  "status": "PENDING",
  "retries": 0,
  "max_retries": 3,
  "created_at": "2026-08-07T17:00:00Z",
  "started_at": null,
  "completed_at": null,
  "result": null,
  "error": null,
  "source": "portal",
  "portal_item_id": "clxyz123",
  "portal_task_code": "PIAT-0003-0001-005"
}
```

## Campos

### Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Identificador único de la tarea |
| `type` | string | Categoría de la tarea (ver tabla abajo) |
| `agent` | string | Slug del agente: `ares`, `atlas`, `iris`, `orion`, `vesta` |
| `payload` | object | Datos específicos del tipo de tarea |

### Opcionales

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `priority` | string | `MEDIUM` | `HIGH`, `MEDIUM`, `LOW` |
| `max_retries` | int | `3` | Máximo de reintentos antes de DLQ |
| `source` | string | `null` | Origen: `portal`, `discord`, `cron`, `api` |
| `portal_item_id` | string | `null` | ID del BacklogItem en el portal |
| `portal_task_code` | string | `null` | Código legible del item (`PIAT-xxxx`) |
| `requires_approval` | bool | `false` | Fuerza aprobación humana independientemente del tipo |

## Tipos de tarea

| `type` | Descripción | Requiere aprobación |
|--------|-------------|---------------------|
| `code_review` | Revisa código en un repositorio | No |
| `code_change` | Modifica archivos del repositorio | Condicional |
| `deploy` | Despliega a producción | Siempre |
| `db_migration` | Ejecuta migración de base de datos | Siempre |
| `delete_data` | Elimina datos | Siempre |
| `financial` | Operaciones financieras | Siempre |
| `publish` | Publica contenido | Siempre |
| `send_email` | Envía email | Siempre |
| `git_force_push` | Force push a Git | Siempre |
| `infrastructure` | Cambios en infraestructura | Siempre |
| `analysis` | Análisis sin efectos secundarios | No |
| `report` | Generación de reportes | No |
| `search` | Búsqueda de información | No |
| `discord_command` | Originado en Discord (`/tarea`) | Condicional |

## Estados del ciclo de vida

```
PENDING → IN_PROGRESS → DONE
                      → FAILED → (reintento) → PENDING
                               → DLQ (sin reintentos)
PENDING → AWAITING_APPROVAL → APPROVED → IN_PROGRESS
                            → REJECTED → FAILED
```

## Payload por tipo

### `code_review` / `analysis` / `search`

```json
{
  "prompt": "Revisa los endpoints de autenticación en el portal",
  "repo_path": "/root/portal-architechia",
  "context_files": []
}
```

### `code_change`

```json
{
  "prompt": "Agrega validación de email al formulario de login",
  "repo_path": "/root/portal-architechia",
  "context_files": ["/root/portal-architechia/app/login/page.tsx"],
  "branch": "feature/email-validation"
}
```

### `discord_command` (generado por `/tarea`)

```json
{
  "prompt": "texto del usuario en Discord",
  "discord_channel": "sage-atlas",
  "discord_user": "username#0000",
  "discord_message_id": "1234567890"
}
```

## Cómo crear una tarea

```python
from harness import Harness, Task

h = Harness()
task = Task(
    type="code_review",
    agent="atlas",
    priority="HIGH",
    payload={
        "prompt": "Analiza los endpoints de /api/backlog",
        "repo_path": "/root/portal-architechia",
    },
    source="api",
    portal_item_id="clxyz123",
    portal_task_code="PIAT-0003-0001-005",
)
h.dispatch(task)
```

## Dead Letter Queue (DLQ)

Las tareas que agotan `max_retries` se mueven a la DLQ:
- Redis key: `harness:dlq`
- También persiste en JSON: `/root/harness-queue/dlq.json`
- Se puede reinspeccionar via: `GET /dlq` en harness_api (puerto 8767)

## Monitoreo via API

```bash
# Estado general del Harness
curl http://localhost:8767/

# Tareas pendientes por agente
curl http://localhost:8767/queue/atlas

# Dead Letter Queue
curl http://localhost:8767/dlq

# Estadísticas
curl http://localhost:8767/stats
```
