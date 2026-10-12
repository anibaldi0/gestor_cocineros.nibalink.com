from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.empleado import EmpleadoOut


class EmpleadoReactivarOut(BaseModel):
    """Respuesta al reactivar un empleado.

    Si el usuario vinculado quedo inactivo y se regeneraron las
    credenciales, `password_temporal` muestra la nueva password UNA vez.
    Si no se toco el usuario, `password_temporal` es None.
    """

    empleado: EmpleadoOut
    password_temporal: Optional[str] = None
    usuario_modificado: bool = False
