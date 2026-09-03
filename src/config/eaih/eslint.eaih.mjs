/**
 * Override de ESLint específico para el módulo Executive AI Inbox & Hub.
 *
 * INSTRUCCIÓN: importar este override en `eslint.config.mjs` de la raíz:
 *
 *   import eaihConfig from './src/config/eaih/eslint.eaih.mjs';
 *   export default defineConfig([...nextVitals, ...nextTs, eaihConfig]);
 */

import { globalIgnores } from 'eslint/config';

/** @type {import('eslint').Linter.Config} */
const eaihConfig = {
  name: 'eaih/overrides',
  files: ['src/eaih/**/*', 'src/app/(portal)/inbox/**/*', 'src/app/api/inbox/**/*'],
  rules: {
    // Preferir explicitación de retornos en dominio crítico de privacidad
    '@typescript-eslint/explicit-function-return-type': 'warn',
    // Evitar any en el módulo de PII
    '@typescript-eslint/no-explicit-any': 'error',
  },
};

export default eaihConfig;
