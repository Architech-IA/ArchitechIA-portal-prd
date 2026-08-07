# Onboarding de un Nuevo Agente SAGE

Guía paso a paso para incorporar un nuevo agente al sistema Dev Engine.

## Identidad del agente

Cada agente tiene:
- **Slug**: identificador corto en minúsculas (`ares`, `atlas`, `iris`, `orion`, `vesta`)
- **Nombre**: nombre de presentación (`SAGE-Ares`)
- **Rol**: descripción corta del área de responsabilidad
- **Personalidad**: tono y estilo de comunicación
- **Canales Discord**: canales donde el bot escucha mensajes para este agente
- **Aliases de mención**: cómo puede mencionarlo el usuario (`@ares`, `@Ares`, `ares`)

## Paso 1: Vault del agente

El vault es la memoria persistente del agente (archivos Markdown en `/root/sage-vault/`).

```bash
# Crear estructura de carpetas
mkdir -p /root/sage-vault/agents/<slug>/{notes,logs,context}

# Archivo de perfil del agente
cat > /root/sage-vault/agents/<slug>/profile.md << 'EOF'
# SAGE-NombreAgente

## Rol
[Descripción del área de responsabilidad]

## Capacidades
- [Capacidad 1]
- [Capacidad 2]

## Proyectos activos
- [Proyecto 1]

## Notas importantes
- [Nota 1]
EOF
```

El vault_api sirve estos archivos via REST en el puerto 8766:
```bash
# Verificar que el perfil es accesible
curl http://localhost:8766/agents/<slug>/profile.md
```

## Paso 2: Portal — crear el usuario del agente

El agente necesita un usuario en el portal para ser asignado a tareas.

```bash
# En el VPS, desde /root/portal-architechia/
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.create({
  data: {
    name: 'SAGE-NombreAgente',
    email: 'sage-<slug>@architechia.internal',
    role: 'AGENT',
  }
}).then(u => { console.log('Creado:', u.id); p.\$disconnect(); });
"
```

Guardar el `id` del usuario — es el `assigneeId` que van en los BacklogItems.

## Paso 3: sage_portal_bridge.py — registrar el agente

Editar el diccionario `AGENT_NAMES` en `/root/sage_portal_bridge.py`:

```python
AGENT_NAMES = {
    "ares":    "SAGE-Ares",
    "atlas":   "SAGE-Atlas",
    "iris":    "SAGE-Iris",
    "orion":   "SAGE-Orion",
    "vesta":   "SAGE-Vesta",
    "<slug>":  "SAGE-NombreAgente",   # ← agregar aquí
}
```

## Paso 4: sage_discord.py — routing de canales

Editar `CHANNEL_ROUTING` y `AGENT_IDENTITIES` en `/root/sage_discord.py`:

```python
CHANNEL_ROUTING = {
    # ... canales existentes ...
    "sage-<slug>": "<slug>",     # canal dedicado del agente
    "sage-<area>": "<slug>",     # canal de área si aplica
}

AGENT_IDENTITIES = {
    # ... agentes existentes ...
    "<slug>": {
        "name": "NombreAgente",
        "emoji": "🔷",
        "role": "Área de Responsabilidad",
        "personality": "Descripción del tono y estilo del agente.",
        "mention_alias": ["@<slug>", "@NombreAgente", "<slug>"],
    },
}
```

## Paso 5: sage_executor.py — contexto del agente

El `ContextBuilder` ya es genérico — usa el `agent_id` para leer el vault. No requiere cambios.

Para dar contexto adicional al agente, agregar notas en su vault:
```bash
cat > /root/sage-vault/agents/<slug>/context/stack.md << 'EOF'
# Stack tecnológico de NombreAgente

## Repositorios
- /root/repo-principal (Next.js + Prisma)

## Comandos frecuentes
- npm run dev → desarrollo local
- npx prisma studio → explorar DB

## Contactos
- Product Owner: @usuario
EOF
```

## Paso 6: sage_approval.py — reglas de aprobación

Las reglas en `ALWAYS_REQUIRES_APPROVAL` y `HIGH_RISK_KEYWORDS` aplican a todos los agentes globalmente. Si el nuevo agente tiene tipos de tarea especiales de alto riesgo, agregarlos al set:

```python
ALWAYS_REQUIRES_APPROVAL = {
    "deploy", "db_migration", "delete_data", "financial",
    "publish", "send_email", "git_force_push", "infrastructure",
    "<nuevo_tipo_de_riesgo>",   # ← agregar si aplica
}
```

## Paso 7: Verificar integración

```bash
# 1. Verificar vault
curl http://localhost:8766/agents/<slug>/profile.md

# 2. Verificar que el portal devuelve tareas del agente
python3 -c "
from sage_portal_bridge import PortalClient
c = PortalClient()
tasks = c.get_assigned_tasks('<slug>', 'SAGE-NombreAgente')
print(f'Tareas asignadas: {len(tasks)}')
"

# 3. Test del router Discord (sin token)
python3 /root/sage_discord.py --test

# 4. Test del executor (contexto del agente)
python3 -c "
from sage_executor import ContextBuilder
cb = ContextBuilder('/root/portal-architechia', '/root/sage-vault')
ctx = cb.build_vault_context('<slug>')
print('Vault context:', len(ctx), 'chars')
"
```

## Checklist de onboarding

- [ ] Vault creado en `/root/sage-vault/agents/<slug>/`
- [ ] `profile.md` con rol y capacidades
- [ ] Usuario creado en el portal con rol `AGENT`
- [ ] `assigneeId` guardado para asignar BacklogItems
- [ ] `AGENT_NAMES` actualizado en `sage_portal_bridge.py`
- [ ] `CHANNEL_ROUTING` y `AGENT_IDENTITIES` actualizados en `sage_discord.py`
- [ ] Notas de contexto en vault si el agente tiene stack específico
- [ ] Tests de integración pasando
- [ ] Al menos una tarea asignada en el portal para probar el flujo completo

## Convenciones de nombres

| Artefacto | Formato | Ejemplo |
|-----------|---------|---------|
| Slug | minúsculas, 3-8 chars | `nova` |
| Nombre SAGE | `SAGE-PascalCase` | `SAGE-Nova` |
| Canal Discord | `sage-<slug>` | `sage-nova` |
| Email interno | `sage-<slug>@architechia.internal` | `sage-nova@architechia.internal` |
| Vault path | `/root/sage-vault/agents/<slug>/` | `/root/sage-vault/agents/nova/` |
