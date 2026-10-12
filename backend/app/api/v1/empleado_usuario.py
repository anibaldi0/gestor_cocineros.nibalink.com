"""Gestion del usuario vinculado a un empleado.

Endpoints:
- POST   /api/v1/empleados/{id}/usuario                    -> crear usuario
- POST   /api/v1/empleados/{id}/usuario/reset-password     -> resetear pass
- PATCH  /api/v1/empleados/{id}/usuario                    -> activar/desactivar
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.core.passwords import generar_password_temporal
from app.core.security import hash_password
from app.db.models.enums import Rol
from app.db.models.personas import Empleado, Usuario, UsuarioRol
from app.schemas.usuario import (
    ResetPasswordIn,
    ResetPasswordOut,
    UsuarioCreateOut,
    UsuarioDetalleOut,
)

router = APIRouter(prefix="/empleados", tags=["empleados-usuario"])


def _get_empleado_or_404(db: DbDep, empleado_id: int) -> Empleado:
    emp = db.get(Empleado, empleado_id)
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empleado {empleado_id} no existe",
        )
    return emp


def _usuario_vinculado(db: DbDep, empleado_id: int) -> Usuario | None:
    return (
        db.query(Usuario)
        .filter(Usuario.empleado_id == empleado_id)
        .one_or_none()
    )


@router.post(
    "/{empleado_id}/usuario",
    response_model=UsuarioCreateOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def crear_usuario_de_empleado(
    db: DbDep,
    user: CurrentUserDep,
    empleado_id: int,
    payload: dict,
) -> UsuarioCreateOut:
    """Crea el usuario EMPLEADO vinculado al empleado.

    Body: { "username": "...", "password": "..." (opcional) }

    Si no se manda password, se genera una temporal y se devuelve UNA vez.
    """
    emp = _get_empleado_or_404(db, empleado_id)

    if _usuario_vinculado(db, empleado_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este empleado ya tiene un usuario vinculado",
        )

    username = (payload.get("username") or "").strip().lower()
    if len(username) < 3 or len(username) > 60:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El username debe tener entre 3 y 60 caracteres",
        )

    existente = (
        db.query(Usuario).filter(Usuario.username == username).one_or_none()
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El username '{username}' ya existe",
        )

    password_input = payload.get("password")
    password_final = (
        password_input if password_input else generar_password_temporal()
    )
    autogenerada = not password_input

    usuario = Usuario(
        username=username,
        password_hash=hash_password(password_final),
        empleado_id=empleado_id,
        activo=True,
        debe_cambiar_password=True,
        creado_por=user.id,
    )
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol=Rol.EMPLEADO))
    db.commit()
    db.refresh(usuario)

    return UsuarioCreateOut(
        id=usuario.id,
        username=usuario.username,
        empleado_id=usuario.empleado_id,
        activo=usuario.activo,
        debe_cambiar_password=usuario.debe_cambiar_password,
        fecha_creacion=usuario.fecha_creacion,
        roles=[Rol.EMPLEADO],
        empleado_nombre=f"{emp.apellido}, {emp.nombre}",
        password_autogenerada=autogenerada,
        password_temporal=password_final if autogenerada else None,
    )


@router.post(
    "/{empleado_id}/usuario/reset-password",
    response_model=ResetPasswordOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def reset_password_de_empleado(
    db: DbDep,
    empleado_id: int,
    payload: ResetPasswordIn,
) -> ResetPasswordOut:
    emp = _get_empleado_or_404(db, empleado_id)
    usuario = _usuario_vinculado(db, empleado_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El empleado {emp.apellido}, {emp.nombre} no tiene usuario",
        )

    password_final = payload.password or generar_password_temporal()
    usuario.password_hash = hash_password(password_final)
    usuario.debe_cambiar_password = True
    db.commit()

    return ResetPasswordOut(
        usuario_id=usuario.id,
        username=usuario.username,
        password_temporal=password_final,
        debe_cambiar_password=True,
    )


@router.patch(
    "/{empleado_id}/usuario",
    response_model=UsuarioDetalleOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def actualizar_usuario_de_empleado(
    db: DbDep,
    empleado_id: int,
    payload: dict,
) -> UsuarioDetalleOut:
    emp = _get_empleado_or_404(db, empleado_id)
    usuario = _usuario_vinculado(db, empleado_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El empleado {emp.apellido}, {emp.nombre} no tiene usuario",
        )

    if "username" in payload and payload["username"]:
        nuevo = payload["username"].strip().lower()
        if nuevo != usuario.username:
            choque = (
                db.query(Usuario)
                .filter(Usuario.username == nuevo)
                .one_or_none()
            )
            if choque is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El username '{nuevo}' ya existe",
                )
            usuario.username = nuevo

    if "activo" in payload and payload["activo"] is not None:
        usuario.activo = bool(payload["activo"])

    db.commit()
    db.refresh(usuario)

    roles = [ur.rol for ur in usuario.roles]
    return UsuarioDetalleOut(
        id=usuario.id,
        username=usuario.username,
        empleado_id=usuario.empleado_id,
        activo=usuario.activo,
        debe_cambiar_password=usuario.debe_cambiar_password,
        fecha_creacion=usuario.fecha_creacion,
        roles=roles,
        empleado_nombre=f"{emp.apellido}, {emp.nombre}",
    )
