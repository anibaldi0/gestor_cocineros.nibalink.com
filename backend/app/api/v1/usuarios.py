from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.core.passwords import generar_password_temporal
from app.core.security import hash_password
from app.db.models.enums import Rol
from app.db.models.login import LoginEvento
from app.db.models.personas import Empleado, Usuario, UsuarioRol
from app.schemas.login import (
    LoginEventoOut,
    LoginsUsuarioOut,
    ResumenLoginOut,
)
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
# Helpers
# ----------------------------------------------------------------------
def _roles(user: Usuario) -> set[Rol]:
    return {ur.rol for ur in user.roles}


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
# Listado (solo SUPERADMIN)
# ----------------------------------------------------------------------
@router.get(
    "",
    response_model=list[UsuarioDetalleOut],
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def listar(
    db: DbDep,
    activo: bool | None = None,
    q: str | None = None,
) -> list[UsuarioDetalleOut]:
    """Lista usuarios nivel 1 y 2 (SUPERADMIN y EDITOR). Solo SUPERADMIN.

    Los EMPLEADOs se gestionan desde /empleados/{id}.
    """
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


@router.get(
    "/logins-resumen",
    response_model=list[ResumenLoginOut],
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def logins_resumen(db: DbDep) -> list[ResumenLoginOut]:
    """Total de logins y ultimo login por usuario. Solo superadmin."""
    from sqlalchemy import func as sa_func

    # Sumatoria y max por usuario.
    rows = (
        db.query(
            LoginEvento.usuario_id,
            sa_func.count(LoginEvento.id).label("total"),
            sa_func.max(LoginEvento.fecha).label("ultimo"),
        )
        .group_by(LoginEvento.usuario_id)
        .all()
    )

    # Incluir usuarios sin logins tambien.
    usuarios = db.query(Usuario).all()
    por_usuario = {r.usuario_id: r for r in rows}

    resumen: list[ResumenLoginOut] = []
    for u in usuarios:
        r = por_usuario.get(u.id)
        resumen.append(
            ResumenLoginOut(
                usuario_id=u.id,
                total=r.total if r else 0,
                ultimo_login=r.ultimo if r else None,
            )
        )
    return resumen


@router.get(
    "/{usuario_id}",
    response_model=UsuarioDetalleOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def obtener(db: DbDep, usuario_id: int) -> UsuarioDetalleOut:
    objetivo = _get_or_404(db, usuario_id)
    return _to_detalle(objetivo)


# ----------------------------------------------------------------------
# Crear (solo SUPERADMIN)
# ----------------------------------------------------------------------
@router.post(
    "",
    response_model=UsuarioCreateOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def crear(db: DbDep, user: CurrentUserDep, payload: UsuarioCreate) -> UsuarioCreateOut:
    # Solo se pueden crear gestores (SUPERADMIN o EDITOR).
    if payload.rol == Rol.EMPLEADO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los usuarios EMPLEADO se crean desde el detalle del empleado",
        )

    if db.query(Usuario).filter(Usuario.username == payload.username).one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El username '{payload.username}' ya existe",
        )

    password_final = payload.password or generar_password_temporal()
    autogenerada = payload.password is None

    usuario = Usuario(
        username=payload.username,
        password_hash=hash_password(password_final),
        empleado_id=None,
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
# Actualizar (solo SUPERADMIN)
# ----------------------------------------------------------------------
@router.patch(
    "/{usuario_id}",
    response_model=UsuarioDetalleOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def actualizar(
    db: DbDep, usuario_id: int, payload: UsuarioUpdate
) -> UsuarioDetalleOut:
    objetivo = _get_or_404(db, usuario_id)
    data = payload.model_dump(exclude_unset=True)

    if "rol" in data and data["rol"] is not None:
        nuevo_rol = data["rol"]
        if nuevo_rol == Rol.EMPLEADO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los usuarios EMPLEADO se gestionan desde /empleados/{id}",
            )
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

    if "activo" in data and data["activo"] is not None:
        objetivo.activo = data["activo"]

    db.commit()
    db.refresh(objetivo)
    objetivo = _get_or_404(db, usuario_id)
    return _to_detalle(objetivo)


# ----------------------------------------------------------------------
# Reset password (solo SUPERADMIN)
# ----------------------------------------------------------------------
@router.get(
    "/{usuario_id}/logins",
    response_model=LoginsUsuarioOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def logins_de_usuario(
    db: DbDep,
    usuario_id: int,
    limit: int = 20,
) -> LoginsUsuarioOut:
    u = _get_or_404(db, usuario_id)

    eventos = (
        db.query(LoginEvento)
        .filter(LoginEvento.usuario_id == usuario_id)
        .order_by(LoginEvento.fecha.desc())
        .limit(limit)
        .all()
    )
    total = (
        db.query(LoginEvento)
        .filter(LoginEvento.usuario_id == usuario_id)
        .count()
    )
    ultimo = eventos[0].fecha if eventos else None

    return LoginsUsuarioOut(
        usuario_id=u.id,
        username=u.username,
        total=total,
        ultimo_login=ultimo,
        eventos=[LoginEventoOut.model_validate(e) for e in eventos],
    )


@router.post(
    "/{usuario_id}/reset-password",
    response_model=ResetPasswordOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def reset_password(
    db: DbDep, usuario_id: int, payload: ResetPasswordIn
) -> ResetPasswordOut:
    objetivo = _get_or_404(db, usuario_id)

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
# Desactivar (solo SUPERADMIN)
# ----------------------------------------------------------------------
@router.delete(
    "/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def desactivar(db: DbDep, user: CurrentUserDep, usuario_id: int) -> Response:
    objetivo = _get_or_404(db, usuario_id)
    if objetivo.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podes desactivar tu propio usuario",
        )
    objetivo.activo = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
