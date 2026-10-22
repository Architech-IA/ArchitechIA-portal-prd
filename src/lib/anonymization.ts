/**
 * Pipeline de anonimización y pseudonimización para texto de correos.
 *
 * Objetivo: limpiar PII, nombres propios y datos sensibles antes de enviar
 * contenido a un LLM, garantizando privacidad por diseño en el MVP de
 * Executive AI Inbox & Hub.
 *
 * Características:
 * - Pseudonimización consistente: un mismo valor origina el mismo token.
 * - Reversible: el contexto de mapeo permite restaurar el texto original.
 * - Serializable: el contexto puede guardarse en DB para auditoría.
 * - Extensible: soporta listas de nombres/organizaciones propias del usuario.
 *
 * NOTE: Este módulo usa heurísticas por regex. No reemplaza un NER/PII
 * detector entrenado, pero es suficiente para el corpus inicial del Sprint 3.
 */

import type { InboxMessage, InboxThreadMessage } from './inbox';

export type EntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'CREDIT_CARD'
  | 'IP_ADDRESS'
  | 'URL'
  | 'ID_NUMBER'
  | 'ADDRESS'
  | 'PERSON_NAME'
  | 'ORGANIZATION';

export type ReplacementMap = Record<string, string>;

export interface AnonymizerContext {
  /** original -> token */
  replacements: ReplacementMap;
  /** token -> original */
  reverse: ReplacementMap;
  /** Contador por tipo de entidad para tokens secuenciales. */
  counters: Record<EntityType, number>;
  /** Salt opcional para evitar correlación entre sesiones. */
  salt?: string;
}

export interface AnonymizeOptions {
  /** Entidades a anonimizar. Por defecto todas. */
  entities?: EntityType[];
  /** Nombres propios que deben ser pseudonimizados. */
  customNames?: string[];
  /** Organizaciones propias que deben ser pseudonimizadas. */
  customOrganizations?: string[];
  /** Salt para desvincular tokens entre sesiones. */
  salt?: string;
}

export interface AnonymizationResult {
  text: string;
  context: AnonymizerContext;
  /** Estadísticas de reemplazos por tipo. */
  stats: Record<EntityType, number>;
}

export type AnonymizedInboxMessage = InboxMessage;

const ALL_ENTITIES: EntityType[] = [
  'EMAIL',
  'PHONE',
  'CREDIT_CARD',
  'IP_ADDRESS',
  'URL',
  'ID_NUMBER',
  'ADDRESS',
  'PERSON_NAME',
  'ORGANIZATION',
];

// ---------------------------------------------------------------------------
// Patrones por entidad. Se procesan en orden: primero los más anchos/ambiguos.
// ---------------------------------------------------------------------------
const ENTITY_PATTERNS: Record<Exclude<EntityType, 'PERSON_NAME' | 'ORGANIZATION'>, RegExp> = {
  URL: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/g,
  CREDIT_CARD: /\b(?:\d[\s-]*?){13,19}\b/g,
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  ID_NUMBER: /\b\d{7,9}[A-Za-z]?\b/g,
  ADDRESS:
    /\b(?:Calle|Av\.|Avenida|C\/|Carrera|Cll\.|Cl\.|Paseo|Plaza|Rambla|Rúa|Rua|Str\.|Street|St\.)\s+[A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ\s,.-]+\d+[A-Za-z0-9\s,-]*/gi,
};

const TOKEN_PREFIX: Record<EntityType, string> = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  CREDIT_CARD: 'CARD',
  IP_ADDRESS: 'IP',
  URL: 'URL',
  ID_NUMBER: 'ID',
  ADDRESS: 'ADDR',
  PERSON_NAME: 'PERSON',
  ORGANIZATION: 'ORG',
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function createAnonymizerContext(salt?: string): AnonymizerContext {
  return {
    replacements: {},
    reverse: {},
    counters: ALL_ENTITIES.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<EntityType, number>),
    salt,
  };
}

export function serializeContext(context: AnonymizerContext): string {
  return JSON.stringify(context);
}

export function deserializeContext(serialized: string): AnonymizerContext {
  const parsed = JSON.parse(serialized) as AnonymizerContext;
  if (!parsed.replacements || !parsed.reverse || !parsed.counters) {
    throw new Error('Invalid anonymizer context');
  }
  return parsed;
}

function tokenKey(original: string, salt?: string): string {
  return salt ? `${original}::${salt}` : original;
}

function getOrCreateToken(
  context: AnonymizerContext,
  original: string,
  type: EntityType
): string {
  const key = tokenKey(original, context.salt);
  if (context.replacements[key]) {
    return context.replacements[key];
  }
  context.counters[type] += 1;
  const token = `{{${TOKEN_PREFIX[type]}_${context.counters[type]}}}`;
  context.replacements[key] = token;
  context.reverse[token] = original;
  return token;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function looksLikePhoneNumber(match: string): boolean {
  const digits = match.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  // Evitar confundir números planos de documento con teléfonos:
  // un teléfono debe tener separadores, paréntesis o prefijo internacional.
  return /^\++|\(|\)|[-.\s]/.test(match);
}

function isValidCreditCard(match: string): boolean {
  const digits = match.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  // Luhn check
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.substring(i, i + 1), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function replaceEntity(
  text: string,
  context: AnonymizerContext,
  type: EntityType,
  pattern: RegExp,
  stats: Record<EntityType, number>,
  validator?: (match: string) => boolean
): string {
  return text.replace(pattern, (match) => {
    if (validator && !validator(match)) return match;
    const token = getOrCreateToken(context, match, type);
    stats[type] += 1;
    return token;
  });
}

function replaceCustomList(
  text: string,
  context: AnonymizerContext,
  type: EntityType,
  items: string[],
  stats: Record<EntityType, number>
): string {
  // Ordenar de mayor a menor longitud para que nombres compuestos ganen sobre simples.
  const sorted = items
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let result = text;
  for (const item of sorted) {
    const pattern = new RegExp(`\\b${escapeRegExp(item)}\\b`, 'gi');
    result = result.replace(pattern, (match) => {
      const token = getOrCreateToken(context, match, type);
      stats[type] += 1;
      return token;
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Anonimiza un texto plano devolviendo el texto limpio y el contexto de mapeo.
 *
 * @example
 * const ctx = createAnonymizerContext();
 * const result = anonymizeText(
 *   'Contacta a victoria.ruiz@contoso.com o al +34 612 345 678',
 *   ctx,
 *   { customNames: ['Victoria Ruiz'] }
 * );
 * // 'Contacta a {{EMAIL_1}} o al {{PHONE_1}}'
 */
export function anonymizeText(
  text: string,
  context: AnonymizerContext,
  options: AnonymizeOptions = {}
): AnonymizationResult {
  if (options.salt && !context.salt) {
    context.salt = options.salt;
  }

  const entities = new Set(options.entities ?? ALL_ENTITIES);
  const stats = ALL_ENTITIES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<EntityType, number>);

  let result = text;

  // 1. Estructuras anchas primero.
  if (entities.has('URL')) {
    result = replaceEntity(result, context, 'URL', ENTITY_PATTERNS.URL, stats);
  }

  // 2. Emails.
  if (entities.has('EMAIL')) {
    result = replaceEntity(result, context, 'EMAIL', ENTITY_PATTERNS.EMAIL, stats);
  }

  // 3. Teléfonos (con validación mínima de dígitos y separadores).
  if (entities.has('PHONE')) {
    result = replaceEntity(
      result,
      context,
      'PHONE',
      ENTITY_PATTERNS.PHONE,
      stats,
      looksLikePhoneNumber
    );
  }

  // 4. Tarjetas de crédito/débito.
  if (entities.has('CREDIT_CARD')) {
    result = replaceEntity(
      result,
      context,
      'CREDIT_CARD',
      ENTITY_PATTERNS.CREDIT_CARD,
      stats,
      isValidCreditCard
    );
  }

  // 5. IPs.
  if (entities.has('IP_ADDRESS')) {
    result = replaceEntity(result, context, 'IP_ADDRESS', ENTITY_PATTERNS.IP_ADDRESS, stats);
  }

  // 6. Números de documento/identidad.
  if (entities.has('ID_NUMBER')) {
    result = replaceEntity(result, context, 'ID_NUMBER', ENTITY_PATTERNS.ID_NUMBER, stats);
  }

  // 7. Direcciones postales.
  if (entities.has('ADDRESS')) {
    result = replaceEntity(result, context, 'ADDRESS', ENTITY_PATTERNS.ADDRESS, stats);
  }

  // 8. Nombres propios configurados.
  if (entities.has('PERSON_NAME') && options.customNames && options.customNames.length > 0) {
    result = replaceCustomList(result, context, 'PERSON_NAME', options.customNames, stats);
  }

  // 9. Organizaciones configuradas.
  if (
    entities.has('ORGANIZATION') &&
    options.customOrganizations &&
    options.customOrganizations.length > 0
  ) {
    result = replaceCustomList(
      result,
      context,
      'ORGANIZATION',
      options.customOrganizations,
      stats
    );
  }

  return { text: result, context, stats };
}

/**
 * Restaura el texto original a partir del contexto de mapeo.
 */
export function deanonymizeText(text: string, context: AnonymizerContext): string {
  // Reemplazar de mayor a menor token para no truncar parcialmente.
  const tokens = Object.keys(context.reverse).sort((a, b) => b.length - a.length);
  let result = text;
  for (const token of tokens) {
    const original = context.reverse[token];
    result = result.split(token).join(original);
  }
  return result;
}

/**
 * Anonimiza un mensaje de inbox completo, incluyendo conversación.
 * Mantiene ids, timestamps, flags y proveedor sin alterar.
 */
export function anonymizeInboxMessage(
  message: InboxMessage,
  context: AnonymizerContext,
  options: AnonymizeOptions = {}
): AnonymizationResult & { message: AnonymizedInboxMessage } {
  const names = new Set(options.customNames ?? []);
  names.add(message.senderName);
  message.conversation.forEach((msg) => names.add(msg.senderName));

  const orgs = new Set(options.customOrganizations ?? []);

  const mergedOptions: AnonymizeOptions = {
    ...options,
    customNames: Array.from(names),
    customOrganizations: Array.from(orgs),
  };

  // Pre-tokenizar emails estructurales para que compartan token con el cuerpo.
  const structuralEmails = [
    message.senderEmail,
    ...message.recipientEmails,
    ...message.conversation.map((msg) => msg.senderEmail),
  ].filter((email): email is string => Boolean(email));

  for (const email of new Set(structuralEmails)) {
    anonymizeText(email, context, { entities: ['EMAIL'] });
  }

  const subjectResult = anonymizeText(message.subject, context, mergedOptions);
  const previewResult = anonymizeText(message.bodyPreview, context, mergedOptions);
  const bodyResult = anonymizeText(message.bodyHtml, context, mergedOptions);

  const conversationResults: InboxThreadMessage[] = message.conversation.map((msg) => ({
    ...msg,
    senderName: anonymizeText(msg.senderName, context, {
      ...mergedOptions,
      entities: ['PERSON_NAME'],
    }).text,
    senderEmail: anonymizeText(msg.senderEmail, context, { entities: ['EMAIL'] }).text,
    bodyHtml: anonymizeText(msg.bodyHtml, context, mergedOptions).text,
  }));

  const resultMessage: AnonymizedInboxMessage = {
    ...message,
    senderName: anonymizeText(message.senderName, context, {
      ...mergedOptions,
      entities: ['PERSON_NAME'],
    }).text,
    senderEmail: anonymizeText(message.senderEmail, context, { entities: ['EMAIL'] }).text,
    recipientEmails: message.recipientEmails.map(
      (email) => anonymizeText(email, context, { entities: ['EMAIL'] }).text
    ),
    subject: subjectResult.text,
    bodyPreview: previewResult.text,
    bodyHtml: bodyResult.text,
    conversation: conversationResults,
  };

  return {
    text: bodyResult.text,
    context,
    stats: recalcStats(context),
    message: resultMessage,
  };
}

function recalcStats(context: AnonymizerContext): Record<EntityType, number> {
  const stats = ALL_ENTITIES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<EntityType, number>);

  for (const token of Object.keys(context.reverse)) {
    for (const type of ALL_ENTITIES) {
      if (token.startsWith(`{{${TOKEN_PREFIX[type]}_`)) {
        stats[type] += 1;
        break;
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Validación interna (no depende de framework de test).
// Ejecutar con: node --loader ts-node/esm src/lib/anonymization.ts
// o incluir en suite de tests del proyecto.
// ---------------------------------------------------------------------------

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `[${label}] expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function runSelfChecks(): void {
  const ctx = createAnonymizerContext();
  const sample =
    'Hola Victoria, envía el contrato a victoria.ruiz@contoso.com o llama al +34 612 345 678. Mi IP es 192.168.1.10';
  const result = anonymizeText(sample, ctx, { customNames: ['Victoria'] });

  assertEqual(result.stats.EMAIL, 1, 'email count');
  assertEqual(result.stats.PHONE, 1, 'phone count');
  assertEqual(result.stats.IP_ADDRESS, 1, 'ip count');
  assertEqual(result.stats.PERSON_NAME, 1, 'person count');

  // Consistencia: misma entidad -> mismo token.
  const result2 = anonymizeText('Reenvía a victoria.ruiz@contoso.com', result.context);
  assertEqual(result2.text, 'Reenvía a {{EMAIL_1}}', 'consistent email token');

  // Reversibilidad.
  const restored = deanonymizeText(result.text, result.context);
  assertEqual(restored, sample, 'deanonymize roundtrip');

  // Contexto serializable.
  const serialized = serializeContext(result.context);
  const deserialized = deserializeContext(serialized);
  assertEqual(deanonymizeText(result.text, deserialized), sample, 'serialized context roundtrip');

  // Inbox message.
  const message: InboxMessage = {
    id: 'msg-1',
    externalId: 'EXT-1',
    provider: 'GOOGLE',
    threadId: 't-1',
    senderName: 'Victoria Ruiz',
    senderEmail: 'victoria.ruiz@contoso.com',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Propuesta de Victoria Ruiz',
    bodyPreview: 'Contacta al +34 612 345 678',
    bodyHtml: '<p>Contacta al +34 612 345 678</p>',
    receivedAt: new Date().toISOString(),
    isRead: false,
    isImportant: true,
    categories: ['Comercial'],
    hasAttachments: false,
    conversation: [
      {
        id: 'm-1',
        senderName: 'Victoria Ruiz',
        senderEmail: 'victoria.ruiz@contoso.com',
        bodyHtml: '<p>Hola</p>',
        receivedAt: new Date().toISOString(),
      },
    ],
  };

  const messageCtx = createAnonymizerContext();
  const anonResult = anonymizeInboxMessage(message, messageCtx);
  assertEqual(anonResult.message.senderEmail, '{{EMAIL_1}}', 'sender email tokenized');
  assertEqual(anonResult.message.recipientEmails, ['{{EMAIL_2}}'], 'recipient email tokenized');
  assertEqual(
    anonResult.message.conversation[0].senderEmail,
    '{{EMAIL_1}}',
    'conversation email consistent'
  );

  // Verificar que no queden emails en el cuerpo.
  if (anonResult.message.bodyHtml.includes('@')) {
    throw new Error('bodyHtml still contains raw email');
  }

  // eslint-disable-next-line no-console
  console.log('Anonymization self-checks passed.');
}

// Descomentar para ejecutar verificación manual:
// runSelfChecks();

export { runSelfChecks };
