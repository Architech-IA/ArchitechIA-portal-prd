#!/bin/bash
# =============================================================================
# EAIH — Health Check Script
# Verifica el estado de todos los servicios
# Uso: ./health-check.sh [dev|staging]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV="${1:-staging}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }

case "$ENV" in
  dev|development)
    COMPOSE_FILE="docker-compose.dev.yml"
    APP_PORT=3010
    PG_PORT=5433
    REDIS_PORT=6380
    ;;
  staging)
    COMPOSE_FILE="docker-compose.staging.yml"
    APP_PORT=3011
    PG_PORT=5434
    REDIS_PORT=6381
    ;;
  *)
    echo -e "${RED}Entorno no válido: $ENV${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  EAIH Health Check — $ENV${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""

# --- Docker containers ---
echo "📦 Containers:"
cd "$INFRA_DIR"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

# --- App ---
echo "🌐 App (puerto $APP_PORT):"
if curl -sf "http://localhost:$APP_PORT/api/health" >/dev/null 2>&1; then
  pass "App respondiendo"
else
  fail "App NO responde"
fi

# --- PostgreSQL ---
echo ""
echo "🗄️  PostgreSQL (puerto $PG_PORT):"
if pg_isready -h localhost -p "$PG_PORT" -q 2>/dev/null; then
  pass "PostgreSQL aceptando conexiones"
else
  fail "PostgreSQL no disponible"
fi

# --- Redis ---
echo ""
echo "⚡ Redis (puerto $REDIS_PORT):"
if redis-cli -h localhost -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
  pass "Redis respondiendo"
elif command -v docker >/dev/null 2>&1; then
  # Try via docker
  if docker exec "eaih-redis-$ENV" redis-cli -a "eaih_redis_${ENV}_2026" ping 2>/dev/null | grep -q PONG; then
    pass "Redis respondiendo (via docker)"
  else
    fail "Redis no disponible"
  fi
else
  warn "No se pudo verificar Redis (redis-cli no instalado en host)"
fi

# --- Disk space ---
echo ""
echo "💾 Disk:"
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -lt 80 ]; then
  pass "Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
  warn "Disk usage: ${DISK_USAGE}% (acercándose al límite)"
else
  fail "Disk usage: ${DISK_USAGE}% (CRÍTICO)"
fi

# --- Memory ---
echo ""
echo "🧠 Memory:"
free -h | head -2

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
