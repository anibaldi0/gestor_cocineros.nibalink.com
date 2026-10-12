from fastapi import APIRouter

from app.api.v1 import (
    auth,
    calendario,
    calendario_admin,
    empleado_usuario,
    empleados,
    estadisticas,
    franjas,
    grilla,
    limpieza,
    me,
    publicacion,
    settings,
    turnos,
    usuarios,
    vacaciones,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(calendario.router)
api_router.include_router(calendario_admin.router)
api_router.include_router(empleados.router)
api_router.include_router(empleado_usuario.router)
api_router.include_router(estadisticas.router)
api_router.include_router(franjas.router)
api_router.include_router(grilla.router)
api_router.include_router(limpieza.router)
api_router.include_router(me.router)
api_router.include_router(publicacion.router)
api_router.include_router(settings.router)
api_router.include_router(turnos.router)
api_router.include_router(usuarios.router)
api_router.include_router(vacaciones.router)
