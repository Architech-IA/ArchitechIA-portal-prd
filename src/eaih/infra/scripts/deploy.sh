#!/bin/bash
# =============================================================================
# EAIH — Deploy Script
# Despliega la app en el entorno especificado
# Uso: ./deploy.sh [dev|staging]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV="${1:-staging}"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------------------------------------------------------------
# Validar entorno
# ---------------------------------------------------------------
case "$ENV" in
  dev|development)
    COMPOSE_FILE="docker-compose.dev.yml"
    CONTAINER_APP="eaih-app-dev"
    ;;
  staging)
    COMPOSE_FILE="docker-compose.staging.yml"
    CONTAINER_APP="eaih-app-staging"
    ;;
  *)
    error "Entorno no válido: $ENV (usar 'dev' o 'staging')"
    ;;
esac

log "Desplegando EAIH en entorno: $ENV"
log "Compose file: $COMPOSE_FILE"

# ---------------------------------------------------------------
# 1. Verificar .env file
# ---------------------------------------------------------------
if [ "$ENV" = "staging" ] && [ ! -f "$INFRA_DIR/.env.staging" ]; then
  error ".env.staging no encontrado. Ejecutar setup-vps.sh primero."
fi

# ---------------------------------------------------------------
# 2. Pull última versión
# ---------------------------------------------------------------
log "Descargando última versión..."
cd "$INFRA_DIR"

if [ "$ENV" = "dev" ]; then
  git pull origin main 2>/dev/null || warn "No se pudo hacer git pull (modo offline?)"
fi

# ---------------------------------------------------------------
# 3. Build de imágenes
# ---------------------------------------------------------------
log "Construyendo imágenes..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# ---------------------------------------------------------------
# 4. Detener containers anteriores
# ---------------------------------------------------------------
log "Deteniendo containers anteriores..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

# ---------------------------------------------------------------
# 5. Ejecutar migraciones de DB
# ---------------------------------------------------------------
log "Ejecutando migraciones de base de datos..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis
sleep 5

docker compose -f "$COMPOSE_FILE" run --rm app npx prisma migrate deploy || {
  warn "Migraciones fallaron — intentando prisma db push..."
  docker compose -f "$COMPOSE_FILE" run --rm app npx prisma db push --accept-data-loss
}

# ---------------------------------------------------------------
# 6. Levantar todos los servicios
# ---------------------------------------------------------------
log "Levantando servicios..."
docker compose -f "$COMPOSE_FILE" up -d

# ---------------------------------------------------------------
# 7. Health check
# ---------------------------------------------------------------
log "Verificando salud del servicio..."

if [ "$ENV" = "staging" ]; then
  APP_PORT=3011
else
  APP_PORT=3010
fi

MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:$APP_PORT/api/health" >/dev/null 2>&1; then
    log "✅ App respondiendo en puerto $APP_PORT"
    break
  fi
  RETRY=$((RETRY + 1))
  log "  Esperando app... ($RETRY/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  warn "⚠️  App no responde después de ${MAX_RETRIES} intentos"
  warn "Revisar logs: docker compose -f $COMPOSE_FILE logs app --tail=50"
fi

# ---------------------------------------------------------------
# 8. Resumen
# ---------------------------------------------------------------
echo ""
log "============================================"
log "  EAIH Deploy — Completado ($ENV)"
log "============================================"
log ""
docker compose -f "$COMPOSE_FILE" ps
log ""
log "Logs en tiempo real:"
log "  docker compose -f $COMPOSE_FILE logs -f"
log ""
log "Detener:"
log "  docker compose -f $COMPOSE_FILE down"
