# =============================================================================
# EAIH — Makefile para gestión de entornos
# =============================================================================
.PHONY: help dev dev-down staging staging-down health setup logs-dev logs-staging

help: ## Mostrar ayuda
	@echo ""
	@echo "  EAIH — Comandos disponibles:"
	@echo ""
	@echo "  make setup        — Setup inicial del VPS"
	@echo "  make dev          — Levantar entorno de desarrollo"
	@echo "  make dev-down     — Detener entorno de desarrollo"
	@echo "  make staging      — Levantar entorno de staging"
	@echo "  make staging-down — Detener entorno de staging"
	@echo "  make health       — Verificar salud de servicios"
	@echo "  make logs-dev     — Ver logs de desarrollo"
	@echo "  make logs-staging — Ver logs de staging"
	@echo "  make db-migrate   — Ejecutar migraciones de DB"
	@echo "  make db-studio    — Abrir Prisma Studio"
	@echo "  make backup       — Backup manual de staging"
	@echo ""

# --- Setup ---
setup: ## Setup inicial del VPS
	bash scripts/setup-vps.sh

# --- Development ---
dev: ## Levantar entorno de desarrollo
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "  ✅ EAIH Dev: http://localhost:3010"
	@echo "  📊 pgAdmin: http://localhost:5050"
	@echo ""

dev-down: ## Detener entorno de desarrollo
	docker compose -f docker-compose.dev.yml down

# --- Staging ---
staging: ## Levantar entorno de staging
	docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
	@echo ""
	@echo "  ✅ EAIH Staging: https://localhost:3011"
	@echo "  📈 Prometheus: http://localhost:9090"
	@echo ""

staging-down: ## Detener entorno de staging
	docker compose -f docker-compose.staging.yml down

# --- Health ---
health: ## Verificar salud de servicios
	bash scripts/health-check.sh staging

# --- Logs ---
logs-dev: ## Ver logs de desarrollo
	docker compose -f docker-compose.dev.yml logs -f

logs-staging: ## Ver logs de staging
	docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f

# --- DB ---
db-migrate: ## Ejecutar migraciones de DB (dev)
	docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate deploy

db-studio: ## Abrir Prisma Studio (dev)
	docker compose -f docker-compose.dev.yml run --rm -p 5555:5555 app npx prisma studio

# --- Backup ---
backup: ## Backup manual de staging
	bash scripts/backup.sh
