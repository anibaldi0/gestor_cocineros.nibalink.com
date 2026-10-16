# Gestor de cocineros

Sistema para armar la grilla horaria de la cocina de un complejo que
tiene dos cosas adentro: un colegio (que cierra en verano, invierno y
findes) y un geriatrico (que no cierra nunca). Reemplaza una planilla
de Excel que se imprimia y se colgaba en la pizarra.

No es un sistema de RRHH. No hay datos sensibles, no se liquidan
sueldos, no hay legajos. Es una herramienta para el jefe de cocina,
para que la cocina tenga siempre la guardia minima cubierta y para
que los empleados puedan ver su grilla desde el celular sin tener que
preguntar.

## Como esta pensado

Tres ideas guian casi todas las decisiones:

1. **Advertir, no bloquear.** El sistema nunca impide guardar una
   grilla. Si hay un hueco, si alguien queda con horas de mas, si un
   franco protegido se esta por modificar: avisa con un modal, registra
   quien lo hizo, y listo. La responsabilidad es humana.

2. **El back manda.** El frontend es bobo. Toda la logica de negocio
   (calculo de tipo de dia, semaforo de cobertura, saldo de vacaciones)
   vive en el backend. El front solo pinta lo que le llega.

3. **Mobile first para el empleado.** El editor trabaja comodo en
   pantalla grande. El empleado entra desde el celular, ve su grilla,
   sus francos y sus vacaciones, y se va. Sin inputs, sin checks, sin
   botones que apretar.

## Stack

- Backend: FastAPI + SQLAlchemy 2.0 + Pydantic 2 + PostgreSQL 15.
- Frontend: React + Vite + TypeScript + Tailwind.
- Auth: JWT con bcrypt.
- Todo dockerizado (backend, frontend, db, reverse-proxy). Los
  contenedores se comunican por red interna. Solo el reverse-proxy
  expone puertos.

## Como levantarlo

Requiere Docker, Docker Compose v2 y Node 20+.

    # Base de datos y backend
    docker compose up -d db backend

    # Frontend en modo dev (hot reload, corre nativo)
    cd frontend
    npm install
    npm run dev

El frontend en dev proxea `/api` y `/health` a `http://localhost:8000`.
Abrir `http://localhost:5173`.

### Modo produccion (local)

    docker compose --profile prod up -d --build

Levanta ademas el frontend estatico y el reverse-proxy en el puerto
8080. Util para probar el build completo antes de subir al server.

### Correr los tests

    docker exec -it gestion_cocina_backend pytest -v

## Estructura

    gestion_cocina.nibalink.com/
    |-- docker-compose.yml         perfiles dev y prod
    |-- backend/                   FastAPI + SQLAlchemy + Alembic
    |   |-- app/
    |   |   |-- api/v1/            endpoints
    |   |   |-- core/              config, seguridad, normalizacion, fechas
    |   |   |-- db/models/         tablas y enums
    |   |   |-- schemas/           DTOs Pydantic
    |   |   `-- services/          logica de negocio
    |   `-- alembic/               migraciones
    |-- frontend/                  React + Vite + TS
    |-- db/init/                   scripts de bootstrap de PostgreSQL
    `-- reverse-proxy/             Nginx detras de Cloudflare Tunnel

## Funcionalidad

- Roles: SUPERADMIN, EDITOR, EMPLEADO. Un usuario puede tener varios
  roles y cambiar de modo sin re-loguearse.
- Empleados con normalizacion de nombre, busqueda sin tildes ni
  mayusculas, alta/baja/reactivacion con rotacion de credenciales.
- Grilla mensual: encabezado coloreado por tipo de dia, editor inline,
  semaforo de cobertura, alertas por dia, francos protegidos (CF),
  horas extra.
- Calendario de eventos: feriados, recesos, vacaciones escolares.
  Cuando se carga un feriado sobre dias que ya tenian gente asignada,
  el sistema estima el impacto en horas extra al 100% antes de
  guardar.
- Vacaciones: saldo anual por empleado (lo carga el editor con lo que
  dice RRHH), periodos que se pueden cortar, calculo de fechas segun
  dias corridos o habiles.
- Publicacion de grilla por mes (BORRADOR / PUBLICADO) y version
  imprimible A4 apaisada.
- Dashboard del empleado: turnos, francos, feriados, vacaciones. Solo
  del mes en curso.
- Estadisticas mensuales, anuales e historicas, con export a CSV.
- Settings: reglas de cobertura y umbrales de alertas editables.

## Cosas que no estan (todavia)

- Limpieza: la tabla y los modelos existen pero no hay UI. El plan es
  cola ciclica por tarea (camara, bano, sector).
- Auditoria: la tabla `auditoria` esta creada y pensada append-only,
  pero no hay logging automatico ni UI para consultarla.
- Zona de peligro: solo existe el soft delete de empleados. Falta el
  borrado masivo de turnos, reset de grilla, etc.
- Alertas proactivas: los umbrales estan cargados en settings pero no
  se calculan todavia (dias seguidos trabajados, dias sin franco,
  saldo de horas).

## Un par de detalles de implementacion

**ASCII puro.** Todo el codigo fuente (comentarios, strings de UI,
docstrings) es ASCII. Sin tildes, sin enie, sin comillas tipograficas.
Los datos que carga el usuario en la DB si pueden tener tildes y enies.
La razon es simple: evitar que un editor o una terminal con otro
encoding muestre los caracteres acentuados como simbolos raros.

**Fechas.** Los inputs de fecha del frontend toman 8 digitos DDMMAAAA.
El backend acepta tres formatos: ISO (`2026-10-11`), con barras
(`11/10/2026`) y compacto (`11102026`). Los tres se normalizan a
`datetime.date`.

**Passwords temporales.** Cuando se crea un usuario o se resetea su
password, si el editor no carga una a mano se genera una tipo
`sujeto-verbo-sustantivo` (`tigre-come-pan`). Se muestra UNA sola vez.
No se guarda en claro.

**Francos protegidos (CF).** Un franco pedido con antelacion lleva una
nota obligatoria. Modificarlo requiere doble confirmacion. En la
grilla aparece con `CF` en lugar de `F`.

## Estructura de la DB

15 enums nativos de Postgres, ~22 tablas. Los grupos principales:

- Personas: `empleado`, `usuario`, `usuario_rol`.
- Calendario: `tipo_evento_calendario`, `evento_calendario`.
- Configuracion operativa: `franja`, `franja_tipo_dia`, `regla_cobertura`.
- Operacion diaria: `turno`, `novedad`, `vacaciones_anuales`,
  `hora_extra`, `ajuste_horas`.
- Limpieza: `tipo_tarea_limpieza`, `cola_limpieza`,
  `asignacion_limpieza`, `ciclo_limpieza`.
- Publicacion y sistema: `periodo_grilla`, `alerta_generada`,
  `configuracion`, `auditoria`.

Las migraciones se aplican al arrancar el backend con Alembic.

## Deploy

Va a correr self-hosted en un server propio, detras de Cloudflare
Tunnel. El subdominio es `gestorcocina.nibalink.com`.

Los secretos van en un `.env` que no se sube al repo. El
`.env.example` y `.env.production.example` sirven de referencia.

## Limpieza (carga manual)

Para el MVP, la limpieza se carga a mano. No hay algoritmo automatico
todavia (el codigo existe pero esta parkeado).

Tipos de tarea (con color por defecto):
- Camara: celeste (#06b6d4).
- Bano: violeta (#8b5cf6).
- Sector: verde (#22c55e).

Reglas:
- Un empleado por dia puede tener una sola tarea de limpieza.
- Un tipo de tarea por dia puede asignarse a un solo empleado.
- No hay validacion de grilla (el editor decide a mano).

Endpoints:
- `GET    /api/v1/limpieza/tipos`
- `GET    /api/v1/limpieza/mes?anio&mes`
- `POST   /api/v1/limpieza/asignaciones`
- `PATCH  /api/v1/limpieza/asignaciones/{id}`
- `DELETE /api/v1/limpieza/asignaciones/{id}`

El dashboard del empleado tiene una pestana "Limpieza" que muestra las
asignaciones del mes en curso, con la fecha y una pastilla de color
segun el tipo de tarea.

## Mi panel: solo mes actual

El dashboard personal del empleado muestra SIEMPRE el mes en curso.
No hay navegacion de mes (se quitaron los botones < y >).

Razon: evitar confusion del empleado mirando meses pasados o futuros.
La grilla oficial esta publicada mensualmente; el panel refleja el mes
en vigencia.

## Pendiente: snapshot de publicacion

Hoy el empleado ve la grilla "viva" mientras el mes esta PUBLICADO. Si el
editor edita algo, el empleado lo ve on-the-fly. No hay version congelada.

El plan es guardar un snapshot del contenido al publicar (columna JSONB en
periodo_grilla), de modo que:

- El empleado vea la ultima version publicada, no la viva.
- El editor pueda editar sin que se refleje.
- Al "republicar", el snapshot se actualiza con la grilla actual.

Mientras tanto:
- El PDF impreso y colgado en la pizarra funciona como "version oficial".
- El editor puede usar "Reabrir mes" para volver a borrador si necesita
  editar sin que los empleados vean los cambios.

Prioridad: post-MVP. No bloquea el uso real.
