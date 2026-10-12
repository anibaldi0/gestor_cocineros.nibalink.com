from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.configuracion import Configuracion
from app.db.models.enums import Rol, TipoConfiguracion
from app.db.models.operativa import Franja, ReglaCobertura
from app.schemas.settings import (
    ConfiguracionOut,
    ConfiguracionUpdate,
    ReglaCoberturaOut,
    ReglaCoberturaUpdate,
)

router = APIRouter(prefix="/settings", tags=["settings"])


# ----------------------------------------------------------------------
# Reglas de cobertura
# ----------------------------------------------------------------------
def _regla_to_out(r: ReglaCobertura, franja: Franja | None) -> ReglaCoberturaOut:
    return ReglaCoberturaOut(
        id=r.id,
        tipo_dia_operativo=r.tipo_dia_operativo,
        franja_id=r.franja_id,
        franja_nombre=franja.nombre if franja else f"#{r.franja_id}",
        franja_codigo_corto=franja.codigo_corto if franja else None,
        franja_contexto=franja.contexto if franja else None,
        cantidad_minima=r.cantidad_minima,
        cantidad_ideal=r.cantidad_ideal,
        activo=r.activo,
    )


@router.get(
    "/reglas-cobertura",
    response_model=list[ReglaCoberturaOut],
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_reglas(db: DbDep, _user: CurrentUserDep) -> list[ReglaCoberturaOut]:
    """Lista las reglas de cobertura con datos de la franja."""
    reglas = (
        db.query(ReglaCobertura)
        .order_by(ReglaCobertura.tipo_dia_operativo, ReglaCobertura.id)
        .all()
    )
    franjas = {f.id: f for f in db.query(Franja).all()}
    return [_regla_to_out(r, franjas.get(r.franja_id)) for r in reglas]


@router.patch(
    "/reglas-cobertura/{regla_id}",
    response_model=ReglaCoberturaOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def actualizar_regla(
    db: DbDep, regla_id: int, payload: ReglaCoberturaUpdate
) -> ReglaCoberturaOut:
    regla = db.get(ReglaCobertura, regla_id)
    if regla is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Regla {regla_id} no existe",
        )

    data = payload.model_dump(exclude_unset=True)
    # Validacion cruzada: ideal >= minima
    minima = data.get("cantidad_minima", regla.cantidad_minima)
    ideal = data.get("cantidad_ideal", regla.cantidad_ideal)
    if ideal < minima:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad ideal no puede ser menor a la minima",
        )

    for k, v in data.items():
        setattr(regla, k, v)
    db.commit()
    db.refresh(regla)

    franja = db.get(Franja, regla.franja_id)
    return _regla_to_out(regla, franja)


# ----------------------------------------------------------------------
# Configuracion (umbrales)
# ----------------------------------------------------------------------
@router.get(
    "/configuracion",
    response_model=list[ConfiguracionOut],
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_config(db: DbDep, _user: CurrentUserDep) -> list[ConfiguracionOut]:
    return (
        db.query(Configuracion)
        .order_by(Configuracion.categoria, Configuracion.clave)
        .all()
    )


@router.patch(
    "/configuracion/{clave}",
    response_model=ConfiguracionOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def actualizar_config(
    db: DbDep, clave: str, payload: ConfiguracionUpdate
) -> Configuracion:
    cfg = db.get(Configuracion, clave)
    if cfg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuracion '{clave}' no existe",
        )

    # Validar segun tipo
    valor = payload.valor.strip()
    if cfg.tipo == TipoConfiguracion.INT:
        try:
            int(valor)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{clave}' debe ser un entero",
            )
    elif cfg.tipo == TipoConfiguracion.FLOAT:
        try:
            float(valor)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{clave}' debe ser un numero",
            )
    elif cfg.tipo == TipoConfiguracion.BOOL:
        if valor.lower() not in {"true", "false", "1", "0"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{clave}' debe ser true o false",
            )

    cfg.valor = valor
    db.commit()
    db.refresh(cfg)
    return cfg
