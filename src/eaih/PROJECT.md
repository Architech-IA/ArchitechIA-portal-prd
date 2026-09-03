# EAIH - Estructura base del proyecto

## Resumen

Se configuró la base del MVP **Executive AI Inbox & Hub** dentro del repositorio
existente de ArchiTechIA.

## Entregables de configuración

### 1. Estructura de carpetas

```
src/
├── eaih/                              # Dominio puro del MVP
│   ├── index.ts                       # Barrel export
│   ├── types.ts                       # Tipos de dominio
│   ├── filters.ts                     # Lógica de filtrado
│   ├── dates.ts                       # Formateo de fechas
│   ├── mock.ts                        # Datos de demostración
│   ├── llm.ts                         # Cliente LLM
│   ├── README.md                      # Guía del módulo
│   └── PROJECT.md                     # Este documento
├── app/
│   ├── (portal)/inbox/
│   │   ├── page.tsx                   # Vista existente (compatibilidad)
│   │   ├── _components/               # Componentes de la página
│   │   │   ├── InboxHeader.tsx
│   │   │   ├── InboxList.tsx
│   │   │   ├── InboxDetail.tsx
│   │   │   └── InboxFilters.tsx
│   │   └── _lib/
│   │       └── constants.ts
│   └── api/inbox/
│       └── route.ts                   # Endpoint base GET /api/inbox
├── components/apps/executive-inbox/   # Componentes compartidos
│   ├── README.md
│   └── InboxEmptyState.tsx
├── lib/
│   └── inbox.ts                       # Entrypoint público (re-exports)
└── config/eaih/                       # Templates de configuración
    ├── prettier.config.js
    ├── eslint.eaih.mjs
    ├── env.example
    ├── github/workflows/eaih-ci.yml
    └── README.md
```

### 2. Linters y formateo

- **ESLint**: ya configurado a nivel de proyecto (`eslint.config.mjs`). Se entrega
  un override específico en `src/config/eaih/eslint.eaih.mjs`.
- **Prettier**: template en `src/config/eaih/prettier.config.js` listo para mover
  a la raíz.

### 3. CI/CD

- Template de GitHub Actions en `src/config/eaih/github/workflows/eaih-ci.yml`.
- El workflow ejecuta ESLint, Prettier check y TypeScript type check sobre los
  paths del MVP.

### 4. Variables de entorno

Ejemplo en `src/config/eaih/env.example`. Requeridas para el MVP:

```bash
LLM_API_URL=
LLM_API_KEY=
LLM_MODEL=
```

## Compatibilidad

`src/lib/inbox.ts` sigue siendo el entrypoint público. Todos los imports
existentes (`@/lib/inbox`) continúan funcionando.

## Próximos pasos recomendados

1. Mover los templates de `src/config/eaih/` a la raíz del repositorio.
2. Instalar `prettier`, `husky` y `lint-staged`.
3. Refactorizar `src/app/(portal)/inbox/page.tsx` para usar los nuevos
   componentes modulares (`_components/`).
4. Sprint 2: conectar `/api/inbox` a Prisma + conectores Gmail/Outlook.
5. Sprint 3: integrar `triageEmail`, `summarizeThread` y `draftReply` en la UI.

## Disciplina de marca

El claim del 90% de precisión está **vetado en todo material público** hasta que
Minerva y Sigma validen la metodología (regla acordada en planning).
