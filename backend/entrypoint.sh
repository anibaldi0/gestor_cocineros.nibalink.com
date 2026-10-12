#!/bin/sh
set -e

echo ">> Aplicando migraciones Alembic..."
alembic upgrade head

echo ">> Arrancando uvicorn..."
if [ "$APP_ENV" = "production" ]; then
  # Sin reload, con multiples workers.
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
else
  # Dev: reload para hot reload.
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
