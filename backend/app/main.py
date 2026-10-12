from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine

# Poblar el registry de SQLAlchemy con TODOS los modelos al arrancar.
# Sin esto, la primera query que toque una relationship falla.
from app.db import base as _models_registry  # noqa: F401

app = FastAPI(
    title="Gestion Cocina API",
    version="0.1.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.is_dev else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "service": "backend", "env": settings.app_env}


@app.get("/health/db", tags=["health"])
def health_db() -> dict:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "reachable"}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"DB no accesible: {exc}")
