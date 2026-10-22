/**
 * Configuración de Prettier para el proyecto Executive AI Inbox & Hub.
 *
 * INSTRUCCIÓN: copiar este archivo a la raíz del repositorio como
 * `prettier.config.js` y asegurar que `prettier` esté instalado como
 * devDependency.
 */

/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [],
};

module.exports = config;
