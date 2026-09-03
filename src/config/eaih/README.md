# Configuración de EAIH (templates)

Este directorio contiene **templates** de configuración para el proyecto
Executive AI Inbox & Hub. Las herramientas de linting, formateo y CI/CD
requieren que estos archivos vivan en la raíz del repositorio; sin embargo,
por restricciones del entorno de ejecución se mantienen aquí como referencia
y deben moverse manualmente.

## Archivos a mover

| Archivo actual                               | Destino en raíz                    |
| -------------------------------------------- | ---------------------------------- |
| `src/config/eaih/prettier.config.js`         | `prettier.config.js`               |
| `src/config/eaih/eslint.eaih.mjs`            | importado en `eslint.config.mjs`   |
| `src/config/eaih/github/workflows/eaih-ci.yml` | `.github/workflows/eaih-ci.yml`    |
| `src/config/eaih/env.example`                | `.env.example` (añadir sección EAIH) |

## Dependencias recomendadas

Agregar a `package.json`:

```json
{
  "devDependencies": {
    "prettier": "^3.3.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
```

## Scripts recomendados

```json
{
  "scripts": {
    "lint:eaih": "eslint src/eaih src/app/\\(portal\\)/inbox src/app/api/inbox src/lib/inbox.ts --max-warnings=0",
    "format:eaih": "prettier --write \"src/eaih/**/*\" \"src/app/(portal)/inbox/**/*\" \"src/app/api/inbox/**/*\"",
    "format:eaih:check": "prettier --check \"src/eaih/**/*\" \"src/app/(portal)/inbox/**/*\" \"src/app/api/inbox/**/*\""
  }
}
```

## Hooks recomendados (husky + lint-staged)

`.husky/pre-commit`:

```bash
npx lint-staged
```

`package.json`:

```json
{
  "lint-staged": {
    "src/eaih/**/*.{ts,tsx}": ["eslint --max-warnings=0", "prettier --write"],
    "src/app/(portal)/inbox/**/*.{ts,tsx}": ["eslint --max-warnings=0", "prettier --write"],
    "src/app/api/inbox/**/*.{ts,tsx}": ["eslint --max-warnings=0", "prettier --write"]
  }
}
```

## Nota de seguridad

No commitear credenciales. Las variables de entorno deben cargarse desde
archivos `.env` ignorados por Git.
