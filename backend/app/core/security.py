"""Primitivas de seguridad: hashing de passwords y JWT.
Tipado estricto, sin dependencias implicitas."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Devuelve el hash bcrypt de la password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica plain contra hashed. Devuelve False ante cualquier error."""
    try:
        return _pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def create_access_token(
    subject: str,
    roles: list[str],
    modo_activo: str | None = None,
    expires_minutes: int | None = None,
) -> str:
    """Crea un JWT firmado con HS256. `subject` es el id del usuario (str)."""
    expire_min = expires_minutes or settings.access_token_expire_minutes
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "roles": roles,
        "modo_activo": modo_activo,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expire_min)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un JWT. Lanza JWTError si es invalido o expirado."""
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_token",
    "JWTError",
]
