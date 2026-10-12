from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.core.passwords import generar_password_temporal
from app.core.security import hash_password
from app.db.models.enums import Rol
from app.db.models.personas import Empleado, Usuario, UsuarioRol
from app.schemas.usuario import (
    ResetPasswordIn,
    ResetPasswordOut,
    UsuarioCreate,
    UsuarioCreateOut,
    UsuarioDetalleOut,
    UsuarioUpdate,
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


# ----------------------------------------------------------------------
# Permisos
# ----------------------------------------------------------------------
def _roles(user: Usuario) -> set[Rol]:
    return {ur.rol for ur in user.roles}


def _puede_gestionar(actor: Usuario, objetivo: Usuario) -> bool:
    """Regla: SUPERADMIN gestiona a todos. EDITOR solo a EMPLEADOs."""
    r_actor = _roles(actor)
    r_obj = _roles(objetivo)
    if Rol.SUPERADMIN in r_actor:
        return True
    if Rol.EDITOR in r_actor:
        return r_obj == {Rol.EMPLEADO}
    return False


def _puede_crear_con_rol(actor: Usuario, rol: Rol) -> bool:
    """Desde /usuarios solo se pueden crear gestores (SUPERADMIN, EDITOR).

    Los EMPLEADOs se crean desde el detalle del empleado (/empleados/{id}).
    """
    r_actor = _roles(actor)
    if rol == Rol.EMPLEADO:
        return False
    if Rol.SUPERADMIN in r_actor:
        return True
    if Rol.EDITOR in r_actor:
        return rol == Rol.EDITOR  # editor puede crear otros editores
    return False


def _get_or_404(db: Session, usuario_id: int) -> Usuario:
    u = (
        db.query(Usuario)
        .options(joinedload(Usuario.roles), joinedload(Usuario.empleado))
        .filter(Usuario.id == usuario_id)
        .one_or_none()
    )
    if u is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario {usuario_id} no existe",
        )
    return u


def _to_detalle(u: Usuario) -> UsuarioDetalleOut:
    empleado_nombre = None
    if u.empleado is not None:
        empleado_nombre = f"{u.empleado.apellido}, {u.empleado.nombre}"
    return UsuarioDetalleOut(
        id=u.id,
        username=u.username,
        empleado_id=u.empleado_id,
        activo=u.activo,
        debe_cambiar_password=u.debe_cambiar_password,
        fecha_creacion=u.fecha_creacion,
        roles=sorted([ur.rol for ur in u.roles], key=lambda r: r.value),
        empleado_nombre=empleado_nombre,
    )


# ----------------------------------------------------------------------
# Listado
# ----------------------------------------------------------------------
@router.get("", response_model=list[UsuarioDetalleOut])
def listar(
    db: DbDep,
    user: CurrentUserDep,
    activo: bool | None = None,
    q: str | None = None,
) -> list[UsuarioDetalleOut]:
    """Lista usuarios nivel 1 y 2 (SUPERADMIN y EDITOR).

    Los EMPLEADOs se gestionan desde /empleados/{id}, no desde aca.
    """
    roles_actor = _roles(user)
    if Rol.SUPERADMIN not in roles_actor and Rol.EDITOR not in roles_actor:
        return []

    # Solo usuarios con rol SUPERADMIN o EDITOR (excluye EMPLEADO puro).
    ids_gestores = {
        ur.usuario_id
        for ur in db.query(UsuarioRol)
        .filter(UsuarioRol.rol.in_([Rol.SUPERADMIN, Rol.EDITOR]))
        .all()
    }
    if not ids_gestores:
        return []

    query = (
        db.query(Usuario)
        .options(joinedload(Usuario.roles), joinedload(Usuario.empleado))
        .filter(Usuario.id.in_(ids_gestores))
    )
    if activo is not None:
        query = query.filter(Usuario.activo.is_(activo))
    if q:
        term = q.strip().lower()
        query = query.filter(Usuario.username.like(f"%{term}%"))

    usuarios = query.order_by(Usuario.username).all()
    return [_to_detalle(u) for u in usuarios]


# ----------------------------------------------------------------------
# Detalle
# ----------------------------------------------------------------------
@router.get("/{usuario_id}", response_model=UsuarioDetalleOut)
def obtener(db: DbDep, user: CurrentUserDep, usuario_id: int) -> UsuarioDetalleOut:
    objetivo = _get_or_404(db, usuario_id)
    if not _puede_gestionar(user, objetivo) and user.id != objetivo.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenes permiso para ver este usuario",
        )
    return _to_detalle(objetivo)


# ----------------------------------------------------------------------
# Crear
# ----------------------------------------------------------------------
@router.post(
    "",
    response_model=UsuarioCreateOut,
    status_code=status.HTTP_201_CREATED,
)
def crear(
    db: DbDep, user: CurrentUserDep, payload: UsuarioCreate
) -> UsuarioCreateOut:
    if not _puede_crear_con_rol(user, payload.rol):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No podes crear usuarios con rol {payload.rol.value}",
        )

    if db.query(Usuario).filter(Usuario.username == payload.username).one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El username '{payload.username}' ya existe",
        )

    if payload.empleado_id is not None:
        emp = db.get(Empleado, payload.empleado_id)
        if emp is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Empleado {payload.empleado_id} no existe",
            )
        # Un empleado solo puede tener un usuario
        ya_vinculado = (
            db.query(Usuario)
            .filter(Usuario.empleado_id == payload.empleado_id)
            .one_or_none()
        )
        if ya_vinculado is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El empleado {payload.empleado_id} ya tiene un usuario asignado",
            )

    password_final = payload.password or generar_password_temporal()
    autogenerada = payload.password is None

    usuario = Usuario(
        username=payload.username,
        password_hash=hash_password(password_final),
        empleado_id=payload.empleado_id,
        activo=True,
        debe_cambiar_password=True,
        creado_por=user.id,
    )
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol=payload.rol))
    db.commit()
    db.refresh(usuario)
    usuario = _get_or_404(db, usuario.id)

    base = _to_detalle(usuario)
    return UsuarioCreateOut(
        **base.model_dump(),
        password_autogenerada=autogenerada,
        password_temporal=password_final if autogenerada else None,
    )


# ----------------------------------------------------------------------
# Actualizar
# ----------------------------------------------------------------------
@router.patch("/{usuario_id}", response_model=UsuarioDetalleOut)
def actualizar(
    db: DbDep, user: CurrentUserDep, usuario_id: int, payload: UsuarioUpdate
) -> UsuarioDetalleOut:
    objetivo = _get_or_404(db, usuario_id)
    if not _puede_gestionar(user, objetivo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenes permiso para editar este usuario",
        )

    data = payload.model_dump(exclude_unset=True)

    # Cambio de rol: solo si es valido para el actor
    if "rol" in data and data["rol"] is not None:
        nuevo_rol = data["rol"]
        if not _puede_crear_con_rol(user, nuevo_rol):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No podes asignar el rol {nuevo_rol.value}",
            )
        # Reemplazar roles
        db.query(UsuarioRol).filter(UsuarioRol.usuario_id == objetivo.id).delete(
            synchronize_session=False
        )
        db.add(UsuarioRol(usuario_id=objetivo.id, rol=nuevo_rol))

    if "username" in data and data["username"] != objetivo.username:
        choque = (
            db.query(Usuario)
            .filter(Usuario.username == data["username"])
            .one_or_none()
        )
        if choque is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El username '{data['username']}' ya existe",
            )
        objetivo.username = data["username"]

    if "empleado_id" in data:
        objetivo.empleado_id = data["empleado_id"]

    if "activo" in data and data["activo"] is not None:
        objetivo.activo = data["activo"]

    db.commit()
    db.refresh(objetivo)
    objetivo = _get_or_404(db, usuario_id)
    return _to_detalle(objetivo)


# ----------------------------------------------------------------------
# Reset de password (por editor/superadmin)
# ----------------------------------------------------------------------
@router.post(
    "/{usuario_id}/reset-password",
    response_model=ResetPasswordOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def reset_password(
    db: DbDep, user: CurrentUserDep, usuario_id: int, payload: ResetPasswordIn
) -> ResetPasswordOut:
    objetivo = _get_or_404(db, usuario_id)
    if not _puede_gestionar(user, objetivo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenes permiso para resetear la password de este usuario",
        )

    password_final = payload.password or generar_password_temporal()
    objetivo.password_hash = hash_password(password_final)
    objetivo.debe_cambiar_password = True
    db.commit()

    return ResetPasswordOut(
        usuario_id=objetivo.id,
        username=objetivo.username,
        password_temporal=password_final,
        debe_cambiar_password=True,
    )


# ----------------------------------------------------------------------
# Desactivar (soft delete)
# ----------------------------------------------------------------------
@router.delete(
    "/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def desactivar(db: DbDep, user: CurrentUserDep, usuario_id: int) -> Response:
    objetivo = _get_or_404(db, usuario_id)
    if not _puede_gestionar(user, objetivo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenes permiso para desactivar este usuario",
        )
    # No te podes desactivar a vos mismo
    if objetivo.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podes desactivar tu propio usuario",
        )
    objetivo.activo = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
