from datetime import date as date_type

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.core.busqueda import SQL_FROM, SQL_TO, normalizar_texto_busqueda
from app.core.passwords import generar_password_temporal
from app.core.security import hash_password
from app.db.models.enums import Rol
from app.db.models.personas import Empleado, Usuario
from app.schemas.empleado import (
    EmpleadoCreate,
    EmpleadoOut,
    EmpleadoReactivarIn,
    EmpleadoUpdate,
)
from app.schemas.empleado_reactivar import EmpleadoReactivarOut

router = APIRouter(prefix="/empleados", tags=["empleados"])


def _col_normalizada(col):
    """Aplica translate(lower(col), FROM, TO) para comparar sin acentos."""
    return func.translate(func.lower(col), SQL_FROM, SQL_TO)


def _get_or_404(db: DbDep, empleado_id: int) -> Empleado:
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
        .options(joinedload(Usuario.roles))
        .filter(Usuario.empleado_id == empleado_id)
        .one_or_none()
    )


def _conflicto_dni(existente: Empleado) -> HTTPException:
    codigo = (
        "DNI_DUPLICADO_ACTIVO"
        if existente.activo
        else "DNI_DUPLICADO_INACTIVO"
    )
    mensaje = (
        f"Ya existe un empleado activo con DNI {existente.dni}"
        if existente.activo
        else f"Existe un empleado inactivo con DNI {existente.dni}"
    )
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "codigo": codigo,
            "mensaje": mensaje,
            "empleado_existente": EmpleadoOut.model_validate(
                existente
            ).model_dump(mode="json"),
        },
    )


@router.get("", response_model=list[EmpleadoOut])
def listar(
    db: DbDep,
    _user: CurrentUserDep,
    activo: bool | None = Query(default=None),
    q: str | None = Query(default=None, min_length=1, max_length=60),
) -> list[Empleado]:
    query = db.query(Empleado).options(joinedload(Empleado.usuario))
    if activo is not None:
        query = query.filter(Empleado.activo.is_(activo))
    if q:
        term = normalizar_texto_busqueda(q)
        solo_digitos = "".join(c for c in term if c.isdigit())

        nombre_norm = _col_normalizada(Empleado.nombre)
        apellido_norm = _col_normalizada(Empleado.apellido)

        condiciones = [
            nombre_norm.like(f"%{term}%"),
            apellido_norm.like(f"%{term}%"),
            (apellido_norm + " " + nombre_norm).like(f"%{term}%"),
        ]
        if solo_digitos:
            condiciones.append(Empleado.dni.like(f"%{solo_digitos}%"))
        query = query.filter(or_(*condiciones))
    return query.order_by(Empleado.apellido, Empleado.nombre).all()


@router.get("/{empleado_id}", response_model=EmpleadoOut)
def obtener(db: DbDep, _user: CurrentUserDep, empleado_id: int) -> Empleado:
    emp = (
        db.query(Empleado)
        .options(joinedload(Empleado.usuario))
        .filter(Empleado.id == empleado_id)
        .one_or_none()
    )
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empleado {empleado_id} no existe",
        )
    return emp


@router.post(
    "",
    response_model=EmpleadoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def crear(db: DbDep, payload: EmpleadoCreate) -> Empleado:
    existente = (
        db.query(Empleado).filter(Empleado.dni == payload.dni).one_or_none()
    )
    if existente is not None:
        raise _conflicto_dni(existente)
    emp = Empleado(**payload.model_dump(), activo=True)
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.patch(
    "/{empleado_id}",
    response_model=EmpleadoOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def actualizar(
    db: DbDep, empleado_id: int, payload: EmpleadoUpdate
) -> Empleado:
    emp = _get_or_404(db, empleado_id)
    data = payload.model_dump(exclude_unset=True)

    if "dni" in data and data["dni"] != emp.dni:
        choque = (
            db.query(Empleado).filter(Empleado.dni == data["dni"]).one_or_none()
        )
        if choque is not None:
            raise _conflicto_dni(choque)

    if data.get("activo") is False and emp.activo is True:
        data.setdefault("fecha_baja", date_type.today())

    for k, v in data.items():
        setattr(emp, k, v)

    db.commit()
    db.refresh(emp)
    return emp


@router.post(
    "/{empleado_id}/reactivar",
    response_model=EmpleadoReactivarOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def reactivar(
    db: DbDep,
    empleado_id: int,
    payload: EmpleadoReactivarIn | None = None,
) -> EmpleadoReactivarOut:
    """Reactiva un empleado inactivo.

    Reglas (opcion C):
    - No permite reactivar uno ya activo (409).
    - fecha_ingreso NO se modifica (se preserva la original).
    - fecha_baja se limpia.
    - Si el empleado tiene usuario vinculado inactivo y se mandan
      credenciales nuevas (nuevo_username / nueva_password), se
      actualizan sobre el MISMO registro de usuario (preserva el id).
    - Si no vienen credenciales, el usuario se reactiva tal cual.
    """
    emp = _get_or_404(db, empleado_id)
    if emp.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "codigo": "EMPLEADO_YA_ACTIVO",
                "mensaje": f"El empleado {emp.apellido}, {emp.nombre} ya esta activo",
            },
        )

    password_temporal: str | None = None
    usuario_modificado = False

    if payload is not None:
        data = payload.model_dump(exclude_unset=True)
        nuevo_username = data.pop("nuevo_username", None)
        nueva_password = data.pop("nueva_password", None)
        data.pop("activo", None)
        data.pop("fecha_baja", None)
        data.pop("fecha_ingreso", None)

        # Aplicar cambios al empleado
        if "dni" in data and data["dni"] != emp.dni:
            choque = (
                db.query(Empleado).filter(Empleado.dni == data["dni"]).one_or_none()
            )
            if choque is not None:
                raise _conflicto_dni(choque)
        for k, v in data.items():
            setattr(emp, k, v)

        # Credenciales del usuario (si aplica)
        usuario = _usuario_vinculado(db, emp.id)
        if usuario is not None:
            hubo_cambio = False
            if nuevo_username and nuevo_username != usuario.username:
                choque_u = (
                    db.query(Usuario)
                    .filter(Usuario.username == nuevo_username)
                    .one_or_none()
                )
                if choque_u is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"El username '{nuevo_username}' ya existe",
                    )
                usuario.username = nuevo_username
                hubo_cambio = True

            if nueva_password:
                usuario.password_hash = hash_password(nueva_password)
                usuario.debe_cambiar_password = True
                hubo_cambio = True

            # Reactivar el usuario si estaba inactivo (cascada de la opcion C).
            if not usuario.activo:
                usuario.activo = True
                hubo_cambio = True

            if hubo_cambio:
                usuario_modificado = True

    # Reactivar el empleado siempre
    emp.activo = True
    emp.fecha_baja = None
    db.commit()
    db.refresh(emp)
    db.refresh(emp)

    # Cargar usuario para la respuesta
    emp = (
        db.query(Empleado)
        .options(joinedload(Empleado.usuario))
        .filter(Empleado.id == empleado_id)
        .one()
    )

    return EmpleadoReactivarOut(
        empleado=EmpleadoOut.model_validate(emp),
        password_temporal=password_temporal,
        usuario_modificado=usuario_modificado,
    )


@router.post(
    "/{empleado_id}/reactivar-y-credenciales",
    response_model=EmpleadoReactivarOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def reactivar_con_credenciales_nuevas(
    db: DbDep,
    empleado_id: int,
    payload: EmpleadoReactivarIn,
) -> EmpleadoReactivarOut:
    """Reactiva el empleado y rota las credenciales del usuario vinculado.

    Distinto al endpoint anterior: aca SIEMPRE se genera una password
    temporal nueva si no viene `nueva_password`. Devuelve la password
    UNA sola vez.
    """
    emp = _get_or_404(db, empleado_id)
    if emp.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "codigo": "EMPLEADO_YA_ACTIVO",
                "mensaje": f"El empleado {emp.apellido}, {emp.nombre} ya esta activo",
            },
        )

    # Aplicar cambios al empleado
    data = payload.model_dump(exclude_unset=True)
    nuevo_username = data.pop("nuevo_username", None)
    nueva_password = data.pop("nueva_password", None)
    data.pop("activo", None)
    data.pop("fecha_baja", None)
    data.pop("fecha_ingreso", None)

    if "dni" in data and data["dni"] != emp.dni:
        choque = (
            db.query(Empleado).filter(Empleado.dni == data["dni"]).one_or_none()
        )
        if choque is not None:
            raise _conflicto_dni(choque)
    for k, v in data.items():
        setattr(emp, k, v)

    # Reactivar empleado
    emp.activo = True
    emp.fecha_baja = None

    # Rotar credenciales del usuario
    password_temporal: str | None = None
    usuario_modificado = False

    usuario = _usuario_vinculado(db, emp.id)
    if usuario is not None:
        if nuevo_username and nuevo_username != usuario.username:
            choque_u = (
                db.query(Usuario)
                .filter(Usuario.username == nuevo_username)
                .one_or_none()
            )
            if choque_u is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El username '{nuevo_username}' ya existe",
                )
            usuario.username = nuevo_username

        if nueva_password:
            password_final = nueva_password
            password_temporal = None  # La eligio el editor, no se muestra
        else:
            password_final = generar_password_temporal()
            password_temporal = password_final

        usuario.password_hash = hash_password(password_final)
        usuario.debe_cambiar_password = True
        usuario.activo = True
        usuario_modificado = True

    db.commit()

    emp = (
        db.query(Empleado)
        .options(joinedload(Empleado.usuario))
        .filter(Empleado.id == empleado_id)
        .one()
    )

    return EmpleadoReactivarOut(
        empleado=EmpleadoOut.model_validate(emp),
        password_temporal=password_temporal,
        usuario_modificado=usuario_modificado,
    )


@router.delete(
    "/{empleado_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def eliminar(db: DbDep, empleado_id: int) -> Response:
    """Soft delete del empleado + cascada al usuario vinculado.

    - empleado.activo = false, fecha_baja = hoy.
    - usuario.activo = false (si existe).
    """
    emp = _get_or_404(db, empleado_id)
    emp.activo = False
    if emp.fecha_baja is None:
        emp.fecha_baja = date_type.today()

    # Cascada: desactivar el usuario vinculado
    usuario = (
        db.query(Usuario).filter(Usuario.empleado_id == emp.id).one_or_none()
    )
    if usuario is not None:
        usuario.activo = False

    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
