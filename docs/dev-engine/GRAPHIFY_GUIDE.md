# Guía de Graphify — Knowledge Graph Multi-Repo

## Qué es

Graphify es una herramienta que analiza repositorios de código y construye un grafo de conocimiento: qué funciones existen, de qué dependen, qué archivos las usan. El Dev Engine usa este grafo para dar a los agentes contexto del código antes de que ejecuten tareas.

El grafo se sirve via `graph_api.py` en el puerto **8765** (pm2 id: 3).

## Estructura de archivos

```
/root/graphify-repos/
  repos_registry.json          ← registro de todos los repos indexados

/root/<repo>/
  graphify-out/
    graph.json                 ← grafo del repo (generado por Graphify)
```

## repos_registry.json

```json
[
  {
    "slug": "portal-architechia",
    "path": "/root/portal-architechia",
    "description": "Portal Next.js + Prisma",
    "language": "typescript"
  },
  {
    "slug": "scheduling",
    "path": "/root/scheduling",
    "description": "Sistema de scheduling Python",
    "language": "python"
  }
]
```

Para agregar un repo nuevo:

```bash
python3 -c "
import json
reg_path = '/root/graphify-repos/repos_registry.json'
with open(reg_path) as f:
    repos = json.load(f)
repos.append({
    'slug': 'mi-nuevo-repo',
    'path': '/root/mi-nuevo-repo',
    'description': 'Descripción del repo',
    'language': 'python'
})
with open(reg_path, 'w') as f:
    json.dump(repos, f, indent=2)
print('Repo registrado')
"
```

## Indexar un repositorio

```bash
# Indexar un repo específico
curl -X POST http://localhost:8765/reindex/portal-architechia

# Indexar todos los repos registrados
python3 -c "
import urllib.request, json
with open('/root/graphify-repos/repos_registry.json') as f:
    repos = json.load(f)
for repo in repos:
    req = urllib.request.Request(
        f'http://localhost:8765/reindex/{repo[\"slug\"]}',
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
        print(f'{repo[\"slug\"]}: {data.get(\"status\", \"?\")} — {data.get(\"nodes\", 0)} nodos')
"
```

La indexación puede tardar 1-3 minutos por repo dependiendo del tamaño.

## Consultar el grafo

### Buscar un símbolo

```bash
# Buscar una función, clase o variable por nombre
curl "http://localhost:8765/symbol?name=PortalClient&repo=portal-architechia"
```

Respuesta:
```json
{
  "name": "PortalClient",
  "type": "class",
  "file": "sage_portal_bridge.py",
  "line": 45,
  "repo": "portal-architechia",
  "docstring": "Cliente HTTP del portal...",
  "methods": ["get_assigned_tasks", "mark_done", "update_status"]
}
```

### Ver dependencias de un símbolo

```bash
# Qué usa PortalClient
curl "http://localhost:8765/dependencies?name=PortalClient&repo=portal-architechia"

# Qué usa PortalClient (incluir dependencias transitivas)
curl "http://localhost:8765/dependencies?name=PortalClient&repo=portal-architechia&depth=2"
```

### Nodos "dios" (símbolos más referenciados)

```bash
# Top 10 símbolos más usados en el repo
curl "http://localhost:8765/god-nodes?repo=portal-architechia&top=10"
```

Útil para identificar módulos centrales que requieren más cuidado al modificar.

### Listar repos indexados

```bash
curl http://localhost:8765/
```

```json
{
  "status": "ok",
  "repos": [
    {
      "slug": "portal-architechia",
      "nodes": 847,
      "last_indexed": "2026-08-07T17:00:00Z"
    }
  ]
}
```

## Uso desde el Executor

El `ContextBuilder` en `sage_executor.py` consulta automáticamente el grafo cuando construye el contexto para Claude Code:

```python
cb = ContextBuilder(
    repo_path="/root/portal-architechia",
    vault_path="/root/sage-vault",
    graph_api_url="http://localhost:8765"
)
context = cb.build()
# context incluye: commits recientes + vault del agente + grafo de símbolos relevantes
```

## Cuándo reindexar

- Después de `git pull` con cambios significativos en el código
- Cuando los agentes reportan contexto de código incorrecto u obsoleto
- Semanalmente como mantenimiento rutinario

```bash
# Cron recomendado (reindexar todos los repos a las 3am)
# 0 3 * * * /usr/bin/python3 /root/reindex_all.py >> /root/logs/graphify-cron.log 2>&1
```

## Solución de problemas

### graph.json no encontrado

```bash
# El repo no ha sido indexado todavía
curl -X POST http://localhost:8765/reindex/<slug>
```

### Graphify instalado incorrectamente

```bash
# Verificar instalación
pip show graphify 2>/dev/null || echo "Graphify no instalado"

# Reinstalar
pip install graphify --upgrade
```

### graph_api no responde

```bash
# Ver logs
~/.local/share/pnpm/pm2 logs graph-api --lines 50

# Reiniciar
~/.local/share/pnpm/pm2 restart graph-api
```
