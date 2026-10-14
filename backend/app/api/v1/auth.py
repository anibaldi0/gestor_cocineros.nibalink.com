from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.enums import Rol
from app.db.models.login import LoginEvento
from app.db.models.personas import Usuario
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.usuario import ChangePasswordIn
from app.schemas.usuario import UsuarioMeOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbDep) -> TokenResponse:
    usuario = (
        db.query(Usuario).filter(Usuario.username == payload.username).one_or_none()
    )
    if usuario is None or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o password incorrectos",
        )
    if not verify_password(payload.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o password incorrectos",
        )

    roles: list[Rol] = [ur.rol for ur in usuario.roles]
    if not roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene roles asignados",
        )

    # Modo activo por defecto: el mas "alto" disponible.
    orden = {Rol.SUPERADMIN: 0, Rol.EDITOR: 1, Rol.EMPLEADO: 2}
    modo_activo = sorted(roles, key=lambda r: orden[r])[0]

    token = create_access_token(
        subject=str(usuario.id),
        roles=[r.value for r in roles],
        modo_activo=modo_activo.value,
    )

    # Registrar el ingreso (append-only).
    db.add(LoginEvento(usuario_id=usuario.id))
    db.commit()

    return TokenResponse(
        access_token=token,
        debe_cambiar_password=usuario.debe_cambiar_password,
    )


@router.get("/me", response_model=UsuarioMeOut)
def me(user: CurrentUserDep) -> UsuarioMeOut:
    roles: list[Rol] = [ur.rol for ur in user.roles]
    return UsuarioMeOut(
        id=user.id,
        username=user.username,
        empleado_id=user.empleado_id,
        activo=user.activo,
        debe_cambiar_password=user.debe_cambiar_password,
        fecha_creacion=user.fecha_creacion,
        roles=roles,
        modo_activo=roles[0] if roles else None,
    )


@router.post("/change-password", status_code=200)
def change_password(
    user: CurrentUserDep, db: DbDep, payload: ChangePasswordIn
) -> dict:
    """Cambia la password del propio usuario.

    Requiere la password actual. Al cambiarla, limpia el flag
    debe_cambiar_password.
    """
    if not verify_password(payload.password_actual, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La password actual es incorrecta",
        )
    if payload.password_actual == payload.password_nueva:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La password nueva debe ser distinta a la actual",
        )
    user.password_hash = hash_password(payload.password_nueva)
    user.debe_cambiar_password = False
    db.commit()
    return {"status": "ok", "mensaje": "Password actualizada"}
