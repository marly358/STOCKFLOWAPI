# STOCKFLOWAPI

API REST para administrar productos, categorías, usuarios e inventario con
Express y MongoDB/Mongoose.

## Instalación y configuración

Requisitos: Node.js 20.19 o posterior, npm y una instancia de MongoDB compatible
con transacciones (replica set o clúster sharded).

```powershell
npm ci
Copy-Item .env.example .env
```

Completa `.env` localmente. No guardes credenciales reales en el repositorio:

| Variable | Descripción |
| --- | --- |
| `MONGO_URI` | Cadena de conexión a la base de datos de desarrollo. |
| `PORT` | Puerto HTTP; por defecto `3000`. |
| `JWT_SECRET` | Secreto aleatorio y privado para firmar tokens. |
| `JWT_EXPIRES_IN` | Vigencia del JWT; por defecto `1h`. |
| `ADMIN_NAME` | Nombre para crear el administrador inicial. |
| `ADMIN_EMAIL` | Correo normalizado del administrador inicial. |
| `ADMIN_PASSWORD` | Contraseña inicial fuerte; no se registra en logs. |

Inicia la API con `npm start`. La conexión es necesaria para arrancar el
servidor.

## Administrador inicial y cuentas

El registro público está deshabilitado. Inicializa el primer administrador de
forma explícita después de configurar las variables anteriores:

```powershell
npm run seed:admin
```

El seed es idempotente: si ya existe un administrador con ese correo, no lo
duplica ni cambia su contraseña. Si el correo ya pertenece a una cuenta que no
es administrador, el seed informa el conflicto en lugar de elevar privilegios.
Solo ADMIN puede crear cuentas de bodeguero desde `POST /api/users`; el cuerpo
acepta `nombre`, `email` y `password`, nunca `role`.

Si la base contiene usuarios de la versión anterior con rol `usuario`, ejecuta
una vez la migración explícita antes de habilitar la nueva versión:

```powershell
npm run migrate:roles
```

La migración convierte únicamente ese rol heredado a `bodeguero`. No cambia
cuentas `admin`. Revisa primero que `MONGO_URI` apunte a la base correcta.

## Autenticación, roles y permisos

Inicia sesión con `POST /api/auth/login` enviando correo y contraseña. La
respuesta contiene un JWT; úsalo en rutas privadas como
`Authorization: Bearer <token>`. `GET /api/auth/me` devuelve la identidad
vigente del token. Cada solicitud protegida vuelve a comprobar en la base de
datos que la cuenta existe y sigue activa.

Los únicos roles de aplicación son `admin` y `bodeguero`.

| Operación | ADMIN | BODEGUERO |
| --- | :---: | :---: |
| Iniciar sesión y consultar su perfil | Sí | Sí |
| Crear y administrar cuentas | Sí | No |
| Consultar productos y categorías | Sí | Sí |
| Crear, editar y eliminar productos/categorías | Sí | No |
| Consultar existencias e historial | Sí | Sí |
| Registrar entradas y salidas | Sí | Sí |

Los bodegueros pueden consultar y actualizar sus propios datos permitidos y
cambiar su contraseña proporcionando la actual; no pueden administrar otras
cuentas. El administrador puede restablecer la contraseña de otra cuenta. El
rol y el estado de una cuenta no se cambian mediante la actualización ordinaria
de datos. Un administrador no puede desactivarse a sí mismo.

## Rutas

Todas las rutas de API que no sean login están protegidas según la matriz
anterior. `POST /api/auth/register` responde `403`; no crea cuentas.

| Método | Ruta | Permiso | Resultado |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Público | Emite un JWT con credenciales válidas. |
| `GET` | `/api/auth/me` | Autenticado | Perfil del usuario autenticado. |
| `POST` | `/api/users` | ADMIN | Crea un bodeguero. |
| `GET` | `/api/users` | ADMIN | Lista usuarios sin hashes ni campos internos. |
| `GET` | `/api/users/:id` | ADMIN o propietario | Consulta un usuario autorizado. |
| `PATCH` | `/api/users/:id` | ADMIN o propietario | Actualiza solo `nombre` y `email`. |
| `PATCH` | `/api/users/:id/password` | ADMIN o propietario | Cambia/restablece la contraseña. |
| `PATCH` | `/api/users/:id/desactivar` | ADMIN | Activa/desactiva con `{ "activo": true/false }`. |
| `GET` | `/api/productos` | ADMIN, BODEGUERO | Lista productos; BODEGUERO solo ve activos. |
| `GET` | `/api/productos/:id` | ADMIN, BODEGUERO | Consulta un producto disponible para el rol. |
| `POST` | `/api/productos` | ADMIN | Crea producto con stock inicial cero. |
| `PATCH` | `/api/productos/:id` | ADMIN | Actualiza `nombre`, `precio` o `descripcion`. |
| `DELETE` | `/api/productos/:id` | ADMIN | Elimina físicamente o desactiva si tiene historial. |
| `GET` | `/api/categorias` | ADMIN, BODEGUERO | Lista categorías. |
| `POST` | `/api/categorias` | ADMIN | Crea categoría con nombre normalizado único. |
| `PATCH` | `/api/categorias/:id` | ADMIN | Actualiza nombre o descripción. |
| `DELETE` | `/api/categorias/:id` | ADMIN | Elimina una categoría. |
| `GET` | `/api/inventario/existencias` | ADMIN, BODEGUERO | Existencias de productos activos. |
| `GET` | `/api/inventario/movimientos` | ADMIN, BODEGUERO | Historial con producto y responsable sin datos sensibles. |
| `POST` | `/api/inventario/entradas` | ADMIN, BODEGUERO | Registra una entrada y suma al stock. |
| `POST` | `/api/inventario/salidas` | ADMIN, BODEGUERO | Registra una salida si hay stock suficiente. |

No existe una relación entre productos y categorías en el modelo actual. Por
eso, la eliminación de categoría no borra ni afecta productos.

## Reglas de inventario

El cliente no puede enviar `stock` al crear o actualizar un producto: la API
responde `400`. Las existencias solo cambian mediante movimientos. Para crear
un stock inicial, primero crea el producto y registra una entrada:

```http
POST /api/inventario/entradas
Authorization: Bearer <token>
Content-Type: application/json

{
  "productoId": "<id del producto>",
  "cantidad": 10
}
```

La cantidad debe ser un entero positivo. La fecha y el responsable autenticado
son asignados por el servidor; enviar campos adicionales se rechaza. Cada
movimiento y su cambio de stock se guardan en una transacción. Las salidas usan
una condición atómica de stock disponible; si no alcanza, la API responde
`409 Conflict` sin movimiento ni cambio parcial. Un producto desactivado no
admite nuevas operaciones.

Al eliminar un producto sin movimientos asociados, se elimina físicamente. Si
tiene historial, se desactiva y se conserva junto con sus movimientos para
mantener la trazabilidad; queda excluido de las consultas y movimientos
ordinarios de bodegueros.

## Pruebas

Jest ejecuta las pruebas unitarias y de integración:

```powershell
npm test
npm run test:unit
npm run test:integration
```

Las pruebas de inventario requieren un MongoDB en replica set porque usan
transacciones. `tests/integration/api.test.js` utiliza MongoDB Memory Server
configurado como replica set; la primera ejecución puede requerir descargar su
binario. Las pruebas no deben usar la base de desarrollo.

La colección Postman existente está en
`postman/collections/stockflowapi.postman_collection.json` y el entorno en
`postman/environments/local.postman_environment.json`. Newman requiere que la
API esté ejecutándose con una base local/de pruebas, que el seed haya creado
el administrador y que `adminEmail` y `adminPassword` se configuren en el
entorno de Postman sin guardar credenciales reales en el archivo versionado.
`bodegueroPassword` es una contraseña de fixture local configurable; no la
reutilices en otros entornos.
Las pruebas generan nombres e identificadores únicos. La colección limpia los
productos sin historial y la categoría de prueba; el producto con movimientos
se conserva desactivado para preservar trazabilidad. Evita ejecutar Newman
contra producción.

```powershell
npm run test:postman
```

## CI / GitHub Actions

La pipeline de integración continua usa Node.js 20, instala dependencias con
`npm ci` y ejecuta la validación real del proyecto en cada push y pull request:

- `npm test` para la suite de Jest completa.
- `npm run test:unit` y `npm run test:integration` para validación aislada.
- `npm run test:postman` para validar la colección de Newman contra la API.

El flujo está definido en `.github/workflows/ci.yml` y no expone secretos ni
credenciales reales en el repositorio; solo usa variables de entorno del
entorno de CI y una base de pruebas local o temporaria.
