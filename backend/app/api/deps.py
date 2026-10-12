"""Dependencias reutilizables de FastAPI.
Sin logica de negocio: solo wiring de sesion, auth y roles."""

from __future__ import annotations

from typing import Annotated, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import JWTError, decode_token
from app.db.models.enums import Rol
from app.db.models.personas import Usuario
from app.db.session import SessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


def get_current_user(db: DbDep, token: TokenDep) -> Usuario:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales invalidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except JWTError:
        raise cred_exc

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.isdigit():
        raise cred_exc

    usuario = db.get(Usuario, int(sub))
    if usuario is None or not usuario.activo:
        raise cred_exc
    return usuario


CurrentUserDep = Annotated[Usuario, Depends(get_current_user)]


def _roles_de(usuario: Usuario) -> set[Rol]:
    return {ur.rol for ur in usuario.roles}


def require_role(*roles: Rol) -> "object":
    """Factory de dependencia. Uso:
        @router.get("/x", dependencies=[Depends(require_role(Rol.EDITOR))])
    """

    def checker(user: CurrentUserDep) -> Usuario:
        if not _roles_de(user).intersection(roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requiere uno de los roles: {[r.value for r in roles]}",
            )
        return user

    return Depends(checker)
