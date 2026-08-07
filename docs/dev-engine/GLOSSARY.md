# Glosario del Dev Engine

## Términos del sistema

**AgentChannel**  
Clase en `sage_locks.py` que implementa pub/sub Redis para comunicación entre agentes. Cada agente tiene un canal propio (`sage:events`) y puede publicar eventos o suscribirse a notificaciones de otros agentes.

**ApprovalManager**  
Clase en `sage_approval.py` que gestiona el flujo de aprobación humana. Envía un embed a Discord con botones "Aprobar / Rechazar" y espera la decisión del operador antes de continuar la ejecución.

**ApprovalStore**  
Backend de almacenamiento para el estado de las aprobaciones pendientes. Usa Redis como backend principal (key `harness:approval:{task_id}`) con fallback a JSON en disco.

**Asignee / Assignee**  
Usuario o agente asignado a un BacklogItem. En el contexto de SAGE, el asignee es el agente que ejecutará la tarea (ej: "SAGE-Atlas").

**BacklogItem**  
Tarea individual en el portal ArchiTechIA. Tiene un `taskCode` único (ej: `ADE-0009-0001-003`), un sprint asociado, estado, prioridad y resultado de ejecución.

**Claude Code headless**  
Modo de uso de Claude Code via CLI (`claude -p`) que permite invocar el LLM desde scripts sin interfaz interactiva. El Dev Engine lo usa en `sage_executor.py` para ejecutar tareas de forma autónoma.

**ContextBuilder**  
Clase en `sage_executor.py` que construye el prompt de contexto para Claude Code. Combina: commits recientes del repo (`git log`), archivos modificados (`git diff`), vault del agente, y opcionalmente el grafo de código (Graphify).

**DLQ (Dead Letter Queue)**  
Cola de tareas que fallaron todos sus reintentos. En Redis: `harness:dlq`. Las tareas en la DLQ no se ejecutan automáticamente — requieren revisión manual y re-encolado.

**Épica**  
Agrupación de sprints relacionados. Ej: la épica ADE-0003 contiene los sprints ADE-0003-0001 y ADE-0003-0002.

**Executor**  
Clase en `sage_executor.py` que orquesta la ejecución de una tarea: construye contexto, invoca Claude Code, maneja reintentos con backoff exponencial, registra el resultado en el vault, y actualiza el Harness.

**fechaEjecucion**  
Campo del BacklogItem en Prisma que registra cuándo se ejecutó la tarea. Se almacena en hora local UTC-5 (Colombia). El portal muestra este valor sin conversión de zona horaria.

**Graphify**  
Herramienta de análisis estático que construye un grafo de conocimiento del código. Analiza imports, definiciones de funciones/clases y sus relaciones. El Dev Engine lo usa para dar contexto de código a los agentes.

**Harness**  
Sistema de cola de tareas del Dev Engine. Implementado en `harness.py` con Redis como backend principal y JSON como fallback. Soporta prioridades HIGH/MEDIUM/LOW y tiene API REST en el puerto 8767.

**INTERNAL_API_KEY**  
Clave de autenticación para la API interna del portal. El PortalClient la usa en el header `x-api-key`. Se obtiene de `/root/portal-architechia/.env`.

**invoke_claude()**  
Función en `sage_executor.py` que ejecuta `claude -p --output-format=json` como subproceso y parsea la respuesta. Retorna un dict con `{ok, output, parsed, exit_code, duration_s, error}`.

**Lock / ResourceLock**  
Mecanismo de exclusión mutua distribuida en Redis usando `SET NX EX` (SETNX). Namespace: `sage:lock:{type}:{resource}`. Implementado en `sage_locks.py`.

**Obsidian**  
Editor de notas markdown que usa el mismo formato que el vault de agentes. Las notas del vault son compatibles con Obsidian para uso interactivo.

**PortalClient**  
Cliente HTTP en `sage_portal_bridge.py` que encapsula todas las llamadas a la API del portal: obtener tareas, marcar estados, actualizar resultados.

**pm2**  
Process Manager para Node.js/Python. Gestiona los servicios del Dev Engine con auto-restart y logs persistentes. Instalado en `~/.local/share/pnpm/pm2`.

**pub/sub**  
Patrón publish/subscribe implementado sobre Redis. Permite que un agente publique un evento y otros agentes suscritos lo reciban en tiempo real. Canal: `sage:events`.

**resultado**  
Campo del BacklogItem que almacena el output de la ejecución del agente. Texto libre, generalmente el output parseado de Claude Code o un resumen de la acción realizada.

**SAGE**  
Sistema de Agentes para Gestión Empresarial. Los cinco agentes son: Ares (Operaciones & CRM), Atlas (Arquitectura & Desarrollo), Iris (Análisis & Datos), Orion (Estrategia & Research), Vesta (Finanzas & Gestión).

**SageRouter**  
Clase en `sage_discord.py` que determina a qué agente SAGE dirigir un mensaje de Discord según: (1) mención explícita (@ares), (2) canal de origen (#sage-atlas), (3) fallback a Orion.

**SprintReporter**  
Clase en `sage_reporter.py` que genera reportes de avance del sprint consultando el portal en tiempo real. Exporta markdown y Discord embeds.

**Task**  
Objeto que representa una unidad de trabajo en el Harness. Ver [`TASK_CONTRACT.md`](TASK_CONTRACT.md) para el esquema completo.

**taskCode**  
Identificador legible de un BacklogItem. Formato: `EPICA-SPRINT-SUBTAREA-ITEM` (ej: `ADE-0009-0001-003`).

**Vault**  
Sistema de memoria persistente de los agentes SAGE. Archivos Markdown en `/root/sage-vault/agents/<slug>/`. El `vault_api.py` sirve estos archivos via REST en el puerto 8766.

**VaultClient / sage_memory.py**  
SDK Python para leer y escribir en el vault del agente desde código. Expone métodos como `read_note()`, `write_note()`, `list_notes()`.

## Puertos y servicios

| Puerto | Servicio | Módulo |
|--------|----------|--------|
| 3003 | Portal ArchiTechIA (Next.js API routes) | N/A |
| 6379 | Redis | Docker: `scheduling-redis` |
| 8765 | Knowledge Graph API | `graph_api.py` |
| 8766 | Vault API | `vault_api.py` |
| 8767 | Harness Monitor API | `harness_api.py` |

> Nota: Puerto 3000 es nginx sirviendo el build estático del portal. Las API routes solo responden en el puerto 3003.

## Convenciones de código

| Convención | Descripción |
|-----------|-------------|
| Scripts Prisma | Extensión `.cjs`, `require('@prisma/client')`, ejecutar desde `/root/portal-architechia/` |
| Timestamps | Hora local UTC-5 almacenada directamente (sin conversión), formato ISO 8601 |
| Prioridades | `HIGH` > `MEDIUM` > `LOW` — el Harness procesa HIGH primero |
| Slugs de agente | Minúsculas: `ares`, `atlas`, `iris`, `orion`, `vesta` |
| API key header | `x-api-key: <INTERNAL_API_KEY>` en todas las llamadas al portal |
