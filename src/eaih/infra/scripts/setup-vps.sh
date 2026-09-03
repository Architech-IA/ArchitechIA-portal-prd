#!/bin/bash
# =============================================================================
# EAIH — Setup Inicial del VPS
# Ejecutar una sola vez en el VPS para preparar el entorno
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$(dirname "$(dirname "$INFRA_DIR")")")"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[EAIH]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------------------------------------------------------------
# 1. Verificar requisitos
# ---------------------------------------------------------------
log "Verificando requisitos del sistema..."

command -v docker >/dev/null 2>&1 || error "Docker no está instalado. Instalar: https://docs.docker.com/engine/install/"
command -v docker compose >/dev/null 2>&1 || error "Docker Compose v2 no disponible."

DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
log "Docker version: $DOCKER_VERSION"

# ---------------------------------------------------------------
# 2. Crear redes Docker si no existen
# ---------------------------------------------------------------
log "Creando redes Docker..."

for net in eaih-internal-dev eaih-external-dev eaih-internal-staging eaih-external-staging; do
  if ! docker network inspect "$net" >/dev/null 2>&1; then
    docker network create "$net"
    log "  ✅ Red creada: $net"
  else
    log "  ⏭️  Red ya existe: $net"
  fi
done

# ---------------------------------------------------------------
# 3. Crear directorios de datos persistentes
# ---------------------------------------------------------------
log "Creando directorios de datos persistentes..."

DATA_DIRS=(
  "/opt/eaih/data/postgres-dev"
  "/opt/eaih/data/redis-dev"
  "/opt/eaih/data/postgres-staging"
  "/opt/eaih/data/redis-staging"
  "/opt/eaih/data/prometheus-staging"
  "/opt/eaih/logs/nginx-staging"
  "/opt/eaih/ssl/staging"
  "/opt/eaih/backup"
)

for dir in "${DATA_DIRS[@]}"; do
  mkdir -p "$dir"
  log "  ✅ $dir"
done

# ---------------------------------------------------------------
# 4. Generar certificados auto-firmados para staging (si no existen)
# ---------------------------------------------------------------
SSL_DIR="/opt/eaih/ssl/staging"

if [ ! -f "$SSL_DIR/fullchain.pem" ]; then
  log "Generando certificado auto-firmado para staging..."
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=AR/ST=Buenos_Aires/L=CABA/O=ArchitechIA/CN=eaih-staging.architechia.co"
  log "  ✅ Certificado generado (auto-firmado, 365 días)"
else
  log "  ⏭️  Certificado SSL ya existe"
fi

# ---------------------------------------------------------------
# 5. Crear archivo .env.dev si no existe
# ---------------------------------------------------------------
DEV_ENV="$INFRA_DIR/.env.dev"
DEV_EXAMPLE="$INFRA_DIR/src/eaih/infra/.env.dev.template"

if [ ! -f "$DEV_ENV" ]; then
  log "Creando .env.dev desde template..."
  cat > "$DEV_ENV" << 'EOF'
# EAIH Development Environment
DATABASE_URL="postgresql://eaih_dev:eaih_dev_secret_2026@localhost:5433/eaih_dev?schema=public"
DIRECT_URL="postgresql://eaih_dev:eaih_dev_secret_2026@localhost:5433/eaih_dev?schema=public"
REDIS_URL="redis://:eaih_redis_dev_2026@localhost:6380"
NEXTAUTH_SECRET="eaih-dev-secret-change-in-prod-2026"
NEXTAUTH_URL="http://localhost:3010"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
MS_CLIENT_ID=""
MS_CLIENT_SECRET=""
MS_TENANT_ID="common"
OPENAI_API_KEY=""
NODE_ENV=development
PORT=3010
LOG_LEVEL=debug
EAIH_ENV=development
EOF
  chmod 600 "$DEV_ENV"
  log "  ✅ .env.dev creado — ⚠️  completar con credenciales reales"
else
  log "  ⏭️  .env.dev ya existe"
fi

# ---------------------------------------------------------------
# 6. Crear .env.staging si no existe
# ---------------------------------------------------------------
STAGING_ENV="$INFRA_DIR/.env.staging"

if [ ! -f "$STAGING_ENV" ]; then
  log "Creando .env.staging desde template..."
  
  # Generar passwords aleatorios
  DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  REDIS_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  AUTH_SECRET=$(openssl rand -hex 32)
  
  cat > "$STAGING_ENV" << EOF
# EAIH Staging Environment — Generado: $(date -Iseconds)
DB_STAGING_PASSWORD=$DB_PASS
DATABASE_URL="postgresql://eaih_staging:${DB_PASS}@localhost:5434/eaih_staging?schema=public&pgbouncer=true"
DIRECT_URL="postgresql://eaih_staging:${DB_PASS}@localhost:5434/eaih_staging?schema=public"
REDIS_STAGING_PASSWORD=$REDIS_PASS
REDIS_URL="redis://:${REDIS_PASS}@localhost:6381"
NEXTAUTH_STAGING_SECRET=$AUTH_SECRET
NEXTAUTH_URL="https://eaih-staging.architechia.co"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
MS_CLIENT_ID=""
MS_CLIENT_SECRET=""
MS_TENANT_ID="common"
OPENAI_API_KEY=""
NODE_ENV=production
PORT=3011
LOG_LEVEL=info
EAIH_ENV=staging
EAIH_LOG_ENCRYPTED_FIELDS=false
EAIH_DATA_RETENTION_DAYS=90
EAIH_PII_MASKING=true
VPS_METRICS_URL="http://host-gateway:9100"
VPS_METRICS_TOKEN="ArchitechIA2026*"
EOF
  chmod 600 "$STAGING_ENV"
  log "  ✅ .env.staging creado con passwords generados — ⚠️  completar OAuth/API keys"
  warn "  📌 Guardar las passwords generadas en un gestor seguro"
else
  log "  ⏭️  .env.staging ya existe"
fi

# ---------------------------------------------------------------
# 7. Firewall — Abrir puertos necesarios
# ---------------------------------------------------------------
log "Verificando firewall..."

if command -v ufw >/dev/null 2>&1; then
  for port in 3010 3011 5433 5434 6380 6381 5050 9090 80 443; do
    if ! ufw status | grep -q "$port"; then
      ufw allow "$port/tcp" comment "EAIH port $port"
      log "  ✅ Puerto $port abierto"
    fi
  done
else
  warn "  ufw no encontrado — configurar firewall manualmente"
fi

# ---------------------------------------------------------------
# 8. Configurar logrotate para logs de EAIH
# ---------------------------------------------------------------
log "Configurando logrotate..."

cat > /etc/logrotate.d/eaih << 'EOF'
/opt/eaih/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker kill --signal=USR1 eaih-nginx-staging 2>/dev/null || true
    endscript
}
EOF
log "  ✅ Logrotate configurado (14 días)"

# ---------------------------------------------------------------
# 9. Crontab — Backup automático diario
# ---------------------------------------------------------------
log "Configurando backup automático..."

BACKUP_SCRIPT="$INFRA_DIR/scripts/backup.sh"
cat > "$BACKUP_SCRIPT" << 'BACKUP_EOF'
#!/bin/bash
# EAIH — Backup automático diario
set -euo pipefail

BACKUP_DIR="/opt/eaih/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL (staging)
docker exec eaih-postgres-staging pg_dump -U eaih_staging eaih_staging \
  | gzip > "$BACKUP_DIR/eaih-staging-$DATE.sql.gz"

# Mantener solo últimos 30 backups
find "$BACKUP_DIR" -name "eaih-staging-*.sql.gz" -mtime +30 -delete

echo "[$(date -Iseconds)] Backup completado: eaih-staging-$DATE.sql.gz"
BACKUP_EOF
chmod +x "$BACKUP_SCRIPT"

# Agregar a crontab si no está
if ! crontab -l 2>/dev/null | grep -q "eaih.*backup"; then
  (crontab -l 2>/dev/null; echo "0 3 * * * $BACKUP_SCRIPT >> /opt/eaih/logs/backup.log 2>&1") | crontab -
  log "  ✅ Backup diario configurado (03:00 AM)"
else
  log "  ⏭️  Backup ya configurado en crontab"
fi

# ---------------------------------------------------------------
# 10. Resumen
# ---------------------------------------------------------------
echo ""
log "============================================"
log "  EAIH VPS Setup — Completado"
log "============================================"
log ""
log "Directorios creados:"
log "  /opt/eaih/data/    — Datos persistentes"
log "  /opt/eaih/logs/    — Logs"
log "  /opt/eaih/ssl/     — Certificados SSL"
log "  /opt/eaih/backup/  — Backups automáticos"
log ""
log "Archivos de configuración:"
log "  $INFRA_DIR/.env.dev       — Variables de entorno dev"
log "  $INFRA_DIR/.env.staging   — Variables de entorno staging"
log ""
log "Próximos pasos:"
log "  1. Completar OAuth credentials en .env.dev y .env.staging"
log "  2. cd $INFRA_DIR && make dev    → Levantar entorno dev"
log "  3. cd $INFRA_DIR && make staging → Levantar entorno staging"
log ""
log "⚠️  Recuerda: Los .env files están en /opt/eaih/ y NO están en git"
