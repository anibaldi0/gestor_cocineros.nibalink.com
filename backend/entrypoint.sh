#!/bin/sh
set -e

echo ">> Aplicando migraciones Alembic..."
alembic upgrade head

echo ">> Arrancando uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
