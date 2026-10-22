# Executive AI Inbox & Hub (EAIH)

Módulo de dominio del MVP **Executive AI Inbox & Hub**.

## Alcance del Sprint 1

Este módulo contiene únicamente la base de dominio, tipos, utilidades, datos de demostración y cliente LLM. La sincronización real con Gmail y Outlook se implementará en el Sprint 2; mientras tanto, la capa de API expone datos mock con la misma forma de contrato.

## Estructura

```
src/eaih/
├── types.ts      # Tipos de dominio: mensajes, hilos, filtros, proveedores
├── filters.ts    # Lógica pura de filtrado y conteos
├── dates.ts      # Formateo de fechas para la bandeja
├── mock.ts       # Fixture de demostración (MVP)
├── llm.ts        # Cliente genérico de LLM para triaje, resumen y redacción
└── README.md     # Este archivo
```

## Entrypoint público

Para no dispersar imports, el módulo se consume principalmente desde `src/lib/inbox.ts`, que re-exporta los símbolos públicos:

```ts
import { InboxMessage, applyInboxFilters, MOCK_INBOX_MESSAGES } from '@/lib/inbox';
```

## Reglas de contribución

1. **Dominio puro**: `types.ts`, `filters.ts` y `dates.ts` no deben depender de React ni de Next.js.
2. **No PII real en mocks**: `mock.ts` usa nombres y correos ficticios de demostración.
3. **LLM sin credenciales embebidas**: `llm.ts` lee la URL y token desde variables de entorno.
4. **Claim del 90% vetado en público**: no incluir métricas de precisión en comentarios de dominio ni en la UI hasta validación por Minerva/Sigma.

## Variables de entorno requeridas

```bash
LLM_API_URL=https://api.opencode.ai/v1/chat/completions
LLM_API_KEY=sk-...
LLM_MODEL=opencodes
```
