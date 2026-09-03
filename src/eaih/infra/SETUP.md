# EAIH — VPS Infrastructure Setup Guide
## Provisionar entorno de desarrollo y staging en VPS

**Sprint:** EAIH-0003-0007-004  
**Estado:** Completado  
**VPS:** ArchiTechIA — 177.7.46.87

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    VPS ArchiTechIA (177.7.46.87)             │
│                                                              │
│  ┌──────────────────────┐  ┌───────────────────────────────┐ │
│  │  DESARROLLO (Dev)    │  │  STAGING                      │ │
│  │                      │  │                               │ │
│  │  App      :3010      │  │  App      :3011               │ │
│  │  Postgres :5433      │  │  Postgres :5434               │ │
│  │  Redis    :6380      │  │  Redis    :6381               │ │
│  │  pgAdmin  :5050      │  │  Nginx    :80/:443            │ │
│  │                      │  │  Prometheus :9090             │ │
│  │  Red: eaih-dev       │  │  Red: eaih-staging            │ │
│  └──────────────────────┘  └───────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────┐                                    │
│  │  PORTAL (existente)  │                                    │
│  │  App :3003 (pm2)     │                                    │
│  └──────────────────────┘                                    │
└──────────────────────────────────────────────────────────────┘
```

## Requisitos previos

| Componente | Versión mínima | Verificar |
|---|---|---|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| OpenSSL | 1.1+ | `openssl version` |
| Git | 2.0+ | `git --version` |

## Instalación rápida

```bash
# 1. SSH al VPS
ssh root@177.7.46.87

# 2. Clonar el repo (si no existe)
cd /root
git clone https://github.com/architech-ia/portal.git eaih-repo
cd eaih-repo

# 3. Ejecutar setup inicial
cd src/eaih/infra
bash scripts/setup-vps.sh

# 4. Levantar entorno de desarrollo
make dev

# 5. Verificar salud
make health
```

## Guía detallada

### Paso 1: Setup del VPS

El script `setup-vps.sh` automatiza:

1. **Verifica** que Docker y Docker Compose estén instalados
2. **Crea redes Docker** para aislamiento de entornos
3. **Crea directorios** de datos persistentes en `/opt/eaih/`
4. **Genera certificados SSL** auto-firmados para staging
5. **Crea archivos .env** con passwords generados aleatoriamente
6. **Configura firewall** (puertos 3010, 3011, 5433, 5434, etc.)
7. **Configura logrotate** (14 días de retención)
8. **Programa backups** automáticos diarios a las 3:00 AM

```bash
bash scripts/setup-vps.sh
```

### Paso 2: Configurar credenciales

Los archivos `.env` se generan en `/opt/eaih/` (fuera del repo, por seguridad). Editar para agregar credenciales reales:

```bash
# Variables de entorno de desarrollo
nano /opt/eaih/.env.dev

# Variables de entorno de staging
nano /opt/eaih/.env.staging
```

**Credenciales mínimas requeridas:**
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — OAuth Gmail
- `MS_CLIENT_ID` + `MS_CLIENT_SECRET` — OAuth Outlook
- `OPENAI_API_KEY` — LLM para triaje y resúmenes

### Paso 3: Levantar entornos

#### Desarrollo (hot-reload)

```bash
cd src/eaih/infra
make dev
# App: http://localhost:3010
# pgAdmin: http://localhost:5050
```

#### Staging (build de producción)

```bash
cd src/eaih/infra
make staging
# App: https://localhost:3011
# Prometheus: http://localhost:9090
```

### Paso 4: Base de datos

```bash
# Ejecutar migraciones
make db-migrate

# Abrir Prisma Studio (UI visual)
make db-studio

# Conectar directamente
psql -h localhost -p 5433 -U eaih_dev -d eaih_dev
```

### Paso 5: Verificar

```bash
# Health check completo
make health

# Ver logs en tiempo real
make logs-dev
make logs-staging
```

## Puertos

| Puerto | Servicio | Entorno |
|---|---|---|
| 3010 | EAIH App | Development |
| 3011 | EAIH App | Staging |
| 5433 | PostgreSQL | Development |
| 5434 | PostgreSQL | Staging |
| 6380 | Redis | Development |
| 6381 | Redis | Staging |
| 5050 | pgAdmin | Development |
| 9090 | Prometheus | Staging |
| 80 | HTTP | Nginx |
| 443 | HTTPS | Nginx |

## Redes Docker

| Red | Propósito | Aislamiento |
|---|---|---|
| `eaih-internal-dev` | Comunicación interna dev | No expuesta |
| `eaih-external-dev` | Acceso externo dev | Bridge |
| `eaih-internal-staging` | Comunicación interna staging | No expuesta |
| `eaih-external-staging` | Acceso externo staging | Bridge |

## Backups

- **Automático:** Backup diario a las 3:00 AM de PostgreSQL (staging)
- **Ubicación:** `/opt/eaih/backup/`
- **Retención:** 30 días
- **Manual:** `make backup`

### Restaurar backup

```bash
gunzip -c /opt/eaih/backup/eaih-staging-YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i eaih-postgres-staging psql -U eaih_staging -d eaih_staging
```

## Troubleshooting

### Container no arranca

```bash
# Ver logs del container específico
docker compose -f docker-compose.dev.yml logs app

# Reconstruir desde cero
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up -d
```

### Puerto en uso

```bash
# ¿Qué usa el puerto?
lsof -i :3010

# Matar proceso conflicto
kill -9 $(lsof -t -i :3010)
```

### PostgreSQL rechaza conexiones

```bash
# Verificar que el container está corriendo
docker ps | grep eaih-postgres

# Verificar logs
docker logs eaih-postgres-dev --tail=50

# Reiniciar
docker restart eaih-postgres-dev
```

### Redis sin memoria

```bash
# Verificar uso de memoria
docker exec eaih-redis-dev redis-cli info memory

# Limpiar keys expiradas
docker exec eaih-redis-dev redis-cli flushdb
```

### SSL expirado (staging)

```bash
# Regenerar certificado auto-firmado
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /opt/eaih/ssl/staging/privkey.pem \
  -out /opt/eaih/ssl/staging/fullchain.pem \
  -subj "/C=AR/ST=Buenos_Aires/L=CABA/O=ArchitechIA/CN=eaih-staging.architechia.co"

docker restart eaih-nginx-staging
```

## Comandos útiles

```bash
# Ver todos los containers EAIH
docker ps --filter "name=eaih-*"

# Espacio en uso por volúmenes
docker system df

# Limpiar imágenes no usadas
docker image prune -f

# Verificar connectividad DB desde el host
docker exec eaih-postgres-dev pg_isready -U eaih_dev

# Shell dentro del container de la app
docker exec -it eaih-app-dev sh

# Backup manual rápido
docker exec eaih-postgres-staging pg_dump -U eaih_staging eaih_staging > backup.sql
```

## Seguridad

- [x] Contraseñas generadas aleatoriamente (setup-vps.sh)
- [x] .env files fuera del repo (`/opt/eaih/`)
- [x] Permisos `600` en archivos .env
- [x] Redes Docker aisladas por entorno
- [x] Rate limiting en Nginx (API: 30r/s, Auth: 5r/m)
- [x] Security headers (HSTS, CSP, X-Frame-Options)
- [x] TLS 1.2+ para staging
- [ ] *Pendiente:* Let's Encrypt para staging (reemplazar cert auto-firmado)
- [ ] *Pendiente:* Secrets manager (Vault / AWS Secrets Manager)

## Próximos pasos

1. **Sprint 2:** Conectar Google OAuth y Microsoft Graph API
2. **Sprint 3:** Integrar OpenAI para triaje y resúmenes
3. **Post-MVP:** Migrar a Let's Encrypt para staging con dominio real
4. **Post-MVP:** Implementar Docker Swarm o K3s para alta disponibilidad
