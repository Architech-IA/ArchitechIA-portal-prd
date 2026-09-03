-- =============================================================================
-- EAIH — PostgreSQL Init Script
-- Ejecutado al crear el contenedor por primera vez
-- =============================================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Schema por defecto
SET search_path TO public;

-- Log de init
DO $$
BEGIN
  RAISE NOTICE 'EAIH database initialized successfully';
END $$;
