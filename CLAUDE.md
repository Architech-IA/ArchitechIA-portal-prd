<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Portal ArchiTechIA — Reglas de Seguridad para Agentes

## ⛔ OPERACIONES ABSOLUTAMENTE PROHIBIDAS

### Base de datos (Supabase PostgreSQL — producción)
- **NUNCA** ejecutar `prisma db push --force-reset` → borra TODOS los datos
- **NUNCA** ejecutar `prisma db push --accept-data-loss` → puede borrar datos
- **NUNCA** ejecutar `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE` directo contra Supabase
- **NUNCA** ejecutar comandos destructivos de DB en background (`comando &`)
- **NUNCA** hacer `prisma migrate reset` en producción

### Git
- **NUNCA** `git reset --hard` sin confirmar explícitamente con el usuario
- **NUNCA** `git push --force` a `main`
- **NUNCA** `git clean -fd` sin confirmar

### Sistema
- **NUNCA** `rm -rf` sobre directorios del proyecto sin confirmar
- **NUNCA** modificar crontabs sin avisarle al usuario

---

## ✅ FLUJO CORRECTO PARA CAMBIOS DE SCHEMA

Cuando necesites agregar/modificar columnas en la DB de producción:

1. **Primero hacer backup**: `/root/backup-db.sh`
2. **Aplicar el cambio con ALTER TABLE directamente**:
   ```sql
   ALTER TABLE "NombreModelo" ADD COLUMN "campo" TEXT;
   ```
   via: `psql "$DIRECT_URL" -c "ALTER TABLE ..."`
3. **Regenerar el cliente Prisma**: `npx prisma generate`
4. **Actualizar el schema.prisma** para reflejar el cambio
5. **Nunca usar `db push`** en producción

---

## 📦 BACKUPS

- Script: `/root/backup-db.sh` → genera dump en `/root/backups/`
- Restaurar: `/root/restore-db.sh <nombre_backup.dump>`
- Cron automático: diario a las 3am UTC
- Antes de cualquier operación riesgosa: correr el backup manualmente

---

## ⚙️ STACK

- Next.js 15 App Router — portal en `/root/portal-architechia/`
- DB: PostgreSQL en Supabase (PROJECT REF: `kvgrohjuragivbzvfpkf`)
- ORM: Prisma — schema en `prisma/schema.prisma`
- Deploy: Docker (`docker build` + `docker compose up -d --force-recreate`)
- Puerto: 3003 (proxy nginx → portal.architechia.co)

---

## 🔁 FLUJO DE DEPLOY

```bash
docker build -t portal-architechia .
docker compose up -d --force-recreate
git add -A && git commit -m "descripción" && git push
```
