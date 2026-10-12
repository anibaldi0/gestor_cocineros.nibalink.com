-- Bootstrap inicial del contenedor PostgreSQL.
-- El esquema real se maneja con Alembic (backend/alembic). Este archivo
-- solo prepara extensiones necesarias desde el primer arranque.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
