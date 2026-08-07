# Registro de Decisiones Técnicas del Dev Engine

## DEC-001: Cola de tareas con Redis + JSON fallback

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Usar Redis LPUSH/RPOP como backend principal de la cola del Harness, con fallback automático a archivos JSON en `/root/harness-queue/`.

**Contexto:** Se evaluaron BullMQ (Node.js only), Celery (requiere broker externo dedicado) y RabbitMQ (overhead de operación).

**Razones:**
- Redis ya era requerido para los locks distribuidos de `sage_locks.py`
- Un solo servicio para dos propósitos (cola + locks) simplifica ops
- El fallback JSON permite desarrollo sin Redis corriendo
- No se necesitan las garantías de durabilidad de Celery/RabbitMQ para este caso de uso

**Implicaciones:** Si Redis cae, el Harness opera en modo degradado (JSON). Las tareas en memoria se pierden; las en disco persisten.

---

## DEC-002: Memoria de agentes en Markdown (Vault Obsidian)

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Almacenar la memoria de agentes como archivos Markdown en `/root/sage-vault/`, servidos via `vault_api.py`.

**Razones:**
- Legible por humanos sin herramientas especiales
- Compatible con Obsidian para exploración interactiva
- Fácil de editar manualmente cuando el agente produce output incorrecto
- No requiere una DB adicional
- Git-trackeable para historial de cambios

**Alternativas descartadas:** Vector DB (Pinecone, Weaviate) — overhead operacional excesivo para el volumen actual. DB relacional — demasiado rígido para notas de formato variable.

---

## DEC-003: Claude Code CLI como motor de ejecución

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Invocar Claude Code via `claude -p --output-format=json` en subproceso, en vez de llamar directamente a la API de Anthropic.

**Razones:**
- Claude Code ya tiene herramientas integradas (Read, Edit, Bash, Glob, Grep) que los agentes necesitan
- El flag `--allowedTools` permite restringir qué herramientas usa el agente por tarea
- La salida JSON estructurada facilita el parsing del resultado
- No requiere gestionar manualmente el loop de herramientas

**Limitaciones conocidas:**
- Requiere `ANTHROPIC_API_KEY` configurado en el entorno del proceso
- `--dangerously-skip-permissions` rechazado cuando se corre como root (comportamiento intencional de seguridad de Claude Code v2.1.197+)
- El prompt se pasa via stdin, no como argumento posicional (cuando se usa `--allowedTools`)

---

## DEC-004: Graphify para Knowledge Graph multi-repo

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Usar Graphify (pip) para indexar repos y construir el grafo de código.

**Razones:**
- Soporte multi-lenguaje (Python + TypeScript)
- Grafo exportado como `graph.json` — portable y no requiere servidor de grafo persistente
- API REST simple en `graph_api.py` construida sobre los archivos

**Alternativas descartadas:** ast-grep (solo Python), tree-sitter (requiere bindings por lenguaje), LSP (demasiado pesado para consultas batch).

---

## DEC-005: Discord como interfaz humana principal

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Usar Discord (discord.py 2.x) como canal de comunicación entre humanos y agentes SAGE.

**Razones:**
- El equipo ya usa Discord como herramienta de trabajo
- Slash commands (`/tarea`, `/reporte`, `/estado`) dan UX predecible
- Los embeds permiten reportes visuales estructurados
- El sistema de roles permite controlar quién puede aprobar tareas

**Alternativas descartadas:** Slack (precio), Telegram (sin slash commands nativos en bots), interfaz web propia (costo de desarrollo).

---

## DEC-006: Redis SETNX para locks distribuidos

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Implementar locks distribuidos con `SET NX EX` de Redis, sin librerías de lock externas.

**Razones:**
- Redis ya está en el stack (DEC-001)
- SETNX es suficiente para el caso de uso (un solo nodo Redis, sin cluster)
- Implementación propia de ~100 líneas vs dependencia de `redlock-py` o similar
- TTL automático evita locks huérfanos por crash del agente

**Limitación:** Si Redis corre en cluster multi-nodo en el futuro, habría que migrar a Redlock. Actualmente single-node, no aplica.

---

## DEC-007: Puerto 3003 para la API del portal (no 3000)

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Las API routes de Next.js del portal responden en el puerto 3003. El puerto 3000 está ocupado por nginx sirviendo el build estático.

**Contexto:** Descubierto por error — llamadas iniciales a `:3000/api/*` devolvían HTML del build estático en lugar de JSON.

**Implicación para el código:** Todos los clientes HTTP (PortalClient, scripts de Prisma, health checks) deben usar `localhost:3003`.

---

## DEC-008: Timestamps en hora local UTC-5 sin conversión

**Fecha:** 2026-08-07  
**Estado:** Activo

**Decisión:** Almacenar `fechaEjecucion` en Prisma con el valor de hora local de Colombia (UTC-5) directamente, sin aplicar offset. El portal no realiza conversión de zona horaria al mostrar el valor.

**Razones:**
- El portal (Next.js) muestra el valor almacenado sin conversión
- Aplicar UTC+0 y dejar que el portal lo convierta resultó en horas incorrectas
- La solución simple: obtener `TZ='America/Bogota' date` en el VPS antes de marcar y usar ese valor

**Regla operativa:** Antes de marcar cualquier item como DONE, ejecutar `TZ='America/Bogota' date '+%H:%M'` en el VPS y usar esa hora como timestamp.
