/**
 * Cifrado aplicación-nivel para PII y cuerpos de correo en reposo.
 *
 * Algoritmo: AES-256-GCM
 * - Cada valor cifrado incluye IV + authTag + payload (hex, separados por ':').
 * - La clave se deriva de EMAIL_ENCRYPTION_KEY mediante SHA-256 a 32 bytes.
 * - No se reutiliza IV; el formato soporta rotación de clave futura sin
 *   re-cifrar toda la base de datos en un solo paso.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_ENV = 'EMAIL_ENCRYPTION_KEY';

function getEncryptionKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw || raw.length < 8) {
    throw new Error(
      `${KEY_ENV} no está configurada o es demasiado corta. Es requerida para cifrar correos.`
    );
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Cifra un texto plano. Devuelve una cadena segura para almacenar en la BD.
 */
export function encryptEmailField(plainText: string): string {
  if (plainText === '') return encryptEmailFieldRaw('');
  return encryptEmailFieldRaw(plainText);
}

function encryptEmailFieldRaw(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un campo previamente cifrado con `encryptEmailField`.
 */
export function decryptEmailField(cipherText: string): string {
  const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Formato de campo cifrado inválido');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Cifra un objeto arbitrario como JSON.
 */
export function encryptJson<T>(value: T): string {
  return encryptEmailField(JSON.stringify(value));
}

/**
 * Descifra y parsea un objeto JSON previamente cifrado.
 */
export function decryptJson<T>(cipherText: string): T {
  return JSON.parse(decryptEmailField(cipherText)) as T;
}
