# Arquitectura del Dev Engine

## Diagrama end-to-end

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTERFAZ HUMANA                             │
│                                                                 │
│   Portal ArchiTechIA          Discord Server                    │
│   (Next.js :3003)             (bot sage_discord.py)             │
│   ┌─────────────┐             ┌──────────────────┐             │
│   │ Backlog     │             │ #sage-atlas       │             │
│   │ Items       │             │ #sage-ares        │             │
│   │ Sprints     │             │ /tarea /reporte   │             │
│   └──────┬──────┘             └────────┬─────────┘             │
└──────────┼─────────────────────────────┼───────────────────────┘
           │ HTTP x-api-key              │ discord.py events
           ↓                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  CAPA DE ORQUESTACIÓN                           │
│                                                                 │
│   sage_portal_bridge.py         SageRouter                      │
│   PortalClient                  ┌──────────────────────────┐   │
│   ┌──────────────────┐          │ canal → agente           │   │
│   │ get_tasks()      │          │ mención → agente         │   │
│   │ mark_in_progress │          │ fallback → orion         │   │
│   │ mark_done()      │          └──────────────────────────┘   │
│   └────────┬─────────┘                    │                    │
│            └──────────────────────────────┘                    │
│                          │                                      │
│                          ↓                                      │
│              ┌─────────────────────┐                           │
│              │   sage_approval.py  │  (Human-in-the-loop)      │
│              │   needs_approval()  │                           │
│              │   ApprovalManager   │                           │
│              └──────────┬──────────┘                           │
│                         │ si aprobado                          │
│                         ↓                                      │
│              ┌─────────────────────┐                           │
│              │   harness.py        │  (Cola de tareas)         │
│              │   Redis :6379       │                           │
│              │   HIGH/MEDIUM/LOW   │                           │
│              │   DLQ + retries     │                           │
│              └──────────┬──────────┘                           │
└─────────────────────────┼───────────────────────────────────────┘
                          │ next_task(agent)
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                  CAPA DE EJECUCIÓN                              │
│                                                                 │
│   sage_executor.py                                              │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ Executor.run(task)                                   │     │
│   │   1. ContextBuilder.build(agent, repo)               │     │
│   │      ├─ recent_commits(3)  → git log                 │     │
│   │      ├─ modified_files()   → git diff                │     │
│   │      └─ vault_context()    → sage-vault/agents/      │     │
│   │   2. invoke_claude(prompt, context)                  │     │
│   │      └─ claude -p --output-format=json < prompt      │     │
│   │   3. _log_execution()  → sage-vault logs diarios     │     │
│   │   4. harness.complete() / harness.fail()             │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│   sage_locks.py                                                 │
│   ┌────────────────────────┐                                    │
│   │ ResourceLock (SETNX)   │  ← coordinación entre agentes     │
│   │ AgentChannel (pub/sub) │  ← notificaciones cross-agent     │
│   │ scan_deadlocks()       │  ← limpieza de locks huérfanos    │
│   └────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           ↓                             ↓
┌──────────────────┐          ┌──────────────────────┐
│  sage-vault/     │          │  graph_api.py :8765   │
│  vault_api.py    │          │  Graphify multi-repo  │
│  :8766           │          │                       │
│  ┌────────────┐  │          │  repos_registry.json  │
│  │ agents/    │  │          │  portal → graph.json  │
│  │   ares/    │  │          │  scheduling → graph   │
│  │   atlas/   │  │          │                       │
│  │   iris/    │  │          │  GET /symbol          │
│  │   orion/   │  │          │  GET /dependencies    │
│  │   vesta/   │  │          │  GET /god-nodes       │
│  │ shared/    │  │          │  POST /reindex/{repo} │
│  └────────────┘  │          └──────────────────────┘
└──────────────────┘
```

## Flujo de una tarea típica

```
1. Humano crea tarea en portal o escribe en #sage-atlas
2. Portal Bridge / Discord Router detecta la tarea
3. needs_approval() → si alto riesgo: Discord embed + botones
4. Harness.dispatch(task) → Redis queue HIGH/MEDIUM/LOW
5. Executor.run(task):
   a. ContextBuilder arma prompt con commits + vault del agente
   b. claude -p --output-format=json < prompt (headless, 120s timeout)
   c. Si falla → backoff 2^n → reintento → DLQ si agota
   d. _log_execution() → sage-vault/agents/atlas/logs/2026-08-07.md
6. harness.complete(task, result)
7. PortalClient.mark_done(task, resultado=output)
8. Discord: respuesta formateada con identidad del agente
```

## Decisiones de diseño

Ver [`DECISIONS.md`](DECISIONS.md) para el detalle de cada decisión.

| Decisión | Tecnología elegida | Alternativa descartada |
|----------|-------------------|------------------------|
| Cola de tareas | Redis LPUSH/RPOP | BullMQ (Node.js only) |
| Memoria de agentes | Obsidian markdown + REST | DB relacional |
| Ejecución LLM | Claude Code CLI headless | API directa Anthropic |
| Grafo de código | Graphify (pip) | ast-grep, tree-sitter |
| Interfaz humana | Discord | Slack, Telegram |
| Coordinación | Redis pub/sub + SETNX | ZooKeeper, etcd |
