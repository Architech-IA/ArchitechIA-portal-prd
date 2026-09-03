# Aplicación del modelo de correos encriptados

## 1. Variables de entorno

Agregar a `.env` (o `.env.local`):

```bash
# Mínimo 8 caracteres; se hashea a 32 bytes para AES-256-GCM.
EMAIL_ENCRYPTION_KEY="un-secreto-largo-y-aleatorio-de-al-menos-32-caracteres"
```

> NUNCA reutilizar `MICROSOFT_TOKEN_ENCRYPTION_KEY` ni `NEXTAUTH_SECRET`.
> La clave de correos debe ser rotable de forma independiente.

## 2. Merge del schema

Copiar todo el contenido de `src/db/schema-additions.prisma` (sin las líneas de
comentario inicial) al final de `prisma/schema.prisma`.

Luego agregar en el modelo `User` existente:

```prisma
model User {
  ...campos existentes...

  emailAccounts    EmailAccount[]
  externalMessages ExternalMessage[]
}
```

## 3. Migración y generación de tipos

```bash
npx prisma migrate dev --name add_encrypted_email_models
npx prisma generate
```

## 4. Verificación rápida

```bash
node -e "
const { encryptEmailField, decryptEmailField } = require('./src/lib/emailCrypto');
const c = encryptEmailField('correo confidencial');
console.log('cifrado:', c);
console.log('descifrado:', decryptEmailField(c));
"
```

## 5. Uso desde el pipeline de sincronización

```ts
import { upsertEmailAccount, syncExternalMessage } from '@/lib/emailDb';

const account = await upsertEmailAccount({
  userId,
  provider: 'MICROSOFT',
  accountEmail: 'ceo@architechia.com',
  externalAccountId: '...',
  syncCursor: '...',
});

await syncExternalMessage({
  userId,
  accountId: account.id,
  message: inboxMessage,
});
```

## Notas de privacidad

- Campos cifrados: remitente, destinatarios, asunto, vistas previas, cuerpo,
  cabeceras, adjuntos, resumen de IA y payload crudo.
- Campos en claro: ids técnicos del proveedor, fechas, flags de lectura/
  importancia, proveedor, threadId y score de prioridad IA (cuando exista).
- Todas las relaciones usan `onDelete: Cascade` para eliminar datos del usuario
  si se borra su cuenta.
