# Procedimiento de Restauración — Portal ArchiTechIA

> Documento de referencia ante pérdida de datos en producción.  
> Última actualización: 2026-07-30

---

## 1. Contexto

- **Base de datos**: PostgreSQL en Supabase (ref: `kvgrohjuragivbzvfpkf`, FREE plan — sin backups propios de Supabase)
- **Backups propios**: `/root/backups/` en la VPS `177.7.46.87`
- **Retención**: últimos 10 dumps (rotación automática)
- **Frecuencia**: diario a las 3:00 AM UTC (22:00 UTC-5)
- **Formato**: custom de pg_dump (`-Fc`), binario comprimido

---

## 2. Verificar backups disponibles

```bash
ssh root@177.7.46.87
ls -lh /root/backups/
```

Salida esperada:
```
-rw-r--r-- 1 root root 361K Jul 30 19:51 backup_20260730_1950.dump
-rw-r--r-- 1 root root 361K Jul 30 19:51 backup_20260730_1951.dump
```

> ⚠️ Un archivo de tamaño `0` indica que el backup falló (p. ej. `backup_20260730_1949.dump`).  
> Nunca restaurar desde un dump de 0 bytes.

---

## 3. Hacer backup manual antes de restaurar

Siempre hacer un backup del estado actual antes de restaurar, aunque esté corrupto:

```bash
ssh root@177.7.46.87
/root/backup-db.sh
```

---

## 4. Restaurar desde un backup

```bash
ssh root@177.7.46.87
/root/restore-db.sh backup_20260730_1950.dump
```

El script pedirá confirmación:
```
ADVERTENCIA: Esto sobreescribirá la base de datos actual.
Restaurando desde: /root/backups/backup_20260730_1950.dump
¿Confirmar? (si/no): si
```

Ingresar `si` para continuar.

---

## 5. Restauración manual (sin script interactivo)

Si el script falla o se necesita restaurar en modo no interactivo:

```bash
ssh root@177.7.46.87

/usr/lib/postgresql/17/bin/pg_restore \
  --no-password \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -d "postgresql://postgres.kvgrohjuragivbzvfpkf:Admin.ArchitechIA2026*@aws-1-us-west-2.pooler.supabase.com:5432/postgres" \
  /root/backups/backup_20260730_1950.dump
```

---

## 6. Verificar restauración

```bash
ssh root@177.7.46.87

psql "postgresql://postgres.kvgrohjuragivbzvfpkf:Admin.ArchitechIA2026*@aws-1-us-west-2.pooler.supabase.com:5432/postgres" \
  -c "SELECT 'Solucion' as tabla, COUNT(*) FROM \"Solucion\"
      UNION ALL SELECT 'Epic', COUNT(*) FROM \"Epic\"
      UNION ALL SELECT 'Sprint', COUNT(*) FROM \"Sprint\"
      UNION ALL SELECT 'BacklogItem', COUNT(*) FROM \"BacklogItem\";"
```

Counts esperados (estado estable):
| Tabla | Registros |
|-------|-----------|
| Solucion | ≥ 5 |
| Epic | ≥ 4 |
| Sprint | ≥ 5 |
| BacklogItem | ≥ 15 |

---

## 7. Reiniciar el portal tras restaurar

```bash
ssh root@177.7.46.87
cd /root/portal-architechia
docker compose up -d --force-recreate
```

---

## 8. Qué NO hacer

| Comando | Por qué está prohibido |
|---------|------------------------|
| `npx prisma db push --force-reset` | Destruye TODOS los datos permanentemente |
| `npx prisma db push --accept-data-loss` | Puede destruir datos |
| `npx prisma migrate reset` | Destruye datos de producción |
| `DROP TABLE / DROP SCHEMA / TRUNCATE` | Eliminación permanente sin posibilidad de rollback |

---

## 9. Resultado de prueba de restauración (2026-07-30)

**Prueba realizada**: restore desde `backup_20260730_2349.dump` (364K) sobre producción.  
**Resultado de datos**: ✅ Counts post-restore idénticos al estado pre-restore (Solucion=6, Epic=5, Sprint=6, BacklogItem=25).  
**Errores esperados**: pg_restore reporta ~561 warnings sobre objetos internos de Supabase (event triggers, storage, extensiones) que pertenecen al superusuario — son normales en Supabase FREE y no afectan los datos de aplicación. El script filtra esos warnings automáticamente.  
**Conclusión**: El mecanismo de backup/restore funciona correctamente para los datos del portal.

---

## 10. Incidente del 2026-07-30

**Causa**: `prisma db push --force-reset` ejecutado en background para agregar la columna `empresa` a la tabla `Solucion`.  
**Impacto**: Pérdida total de BacklogItems, Sprints y Epics. 5 soluciones recreadas manualmente.  
**Recuperación**: Reconstrucción manual a partir de memoria de conversación y screenshots.  
**Lección**: Nunca usar `db push` contra producción. Usar `ALTER TABLE` directo vía psql.
