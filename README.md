# STOCKFLOWAPI
Repositorio para practica 

## Actualizar un producto

La ruta `PATCH /api/productos/:id` actualiza parcialmente un producto existente. Se
pueden enviar uno o más de los campos `nombre`, `precio`, `stock` y `descripcion`.
Por ejemplo:

```http
PATCH http://localhost:3000/api/productos/665f1a2b3c4d5e6f78901234
Content-Type: application/json

{
  "precio": 19.99,
  "stock": 25
}
```


## Gestionar categorías

`POST /api/categorias` crea una categoría. El campo `nombre` es obligatorio; `descripcion` es opcional.

```http
POST http://localhost:3000/api/categorias
Content-Type: application/json

{
  "nombre": "Bebidas",
  "descripcion": "Productos de bebidas"
}
```

`GET /api/categorias` devuelve las categorías registradas como un arreglo JSON.

## Gestionar inventario

Los movimientos se registran dentro de transacciones MongoDB para actualizar el
stock y guardar el movimiento de forma consistente. La base de datos debe
soportar transacciones (como MongoDB Atlas en un replica set o clúster
sharded); si no las admite, la operación falla sin aplicar cambios parciales.

`POST /api/inventario/entradas` registra una entrada y aumenta el stock:

```http
POST http://localhost:3000/api/inventario/entradas
Content-Type: application/json

{
  "productoId": "665f1a2b3c4d5e6f78901234",
  "cantidad": 10
}
```

`POST /api/inventario/salidas` registra una salida y disminuye el stock. Si no
hay existencias suficientes, devuelve `409 Conflict` y no registra el
movimiento.

```http
POST http://localhost:3000/api/inventario/salidas
Content-Type: application/json

{
  "productoId": "665f1a2b3c4d5e6f78901234",
  "cantidad": 2
}
```

Ambos endpoints devuelven `201 Created` con el movimiento y el producto
actualizado. La cantidad debe ser un entero positivo; `productoId` debe
identificar un producto existente.

`GET /api/inventario/existencias` devuelve las existencias actuales como una
lista JSON, que será `[]` si todavía no hay productos:

```http
GET http://localhost:3000/api/inventario/existencias
```

Cada elemento contiene el identificador del producto, su nombre y el stock
actual, por ejemplo:

```json
[
  {
    "_id": "665f1a2b3c4d5e6f78901234",
    "nombre": "Producto de ejemplo",
    "stock": 8
  }
]
```

## Eliminar un producto

La ruta `DELETE /api/productos/:id` elimina el producto cuyo identificador
MongoDB se indica en la URL. Si se elimina, responde `200` con un mensaje y el
producto eliminado. Un identificador inválido responde `400`; si no existe un
producto con ese ID, responde `404`.

Ejemplo:

```http
DELETE http://localhost:3000/api/productos/665f1a2b3c4d5e6f78901234
```

Respuesta al eliminar:

```json
{
  "message": "Producto eliminado correctamente.",
  "producto": {
    "_id": "665f1a2b3c4d5e6f78901234",
    "nombre": "Producto de ejemplo",
    "precio": 19.99,
    "stock": 25
  }
}
```

Los movimientos de inventario guardan una referencia al producto. Esta
operación elimina únicamente el producto y no elimina los movimientos
relacionados.

## Pruebas de integración con Postman y Newman

La colección exportable está en
`postman/collections/stockflowapi.postman_collection.json` y el entorno local
en `postman/environments/local.postman_environment.json`. La colección cubre
el estado de la API, productos, categorías y movimientos de inventario,
incluidas validaciones de entradas inválidas y recursos inexistentes.

### Requisitos

- Node.js y las dependencias del proyecto instaladas (`npm install`).
- Una instancia de MongoDB Atlas o MongoDB compatible con transacciones
  configurada mediante `MONGO_URI` en el archivo `.env` local. No copies
  credenciales al entorno ni a la colección.
- El servidor iniciado en `http://localhost:3000`, que es el valor inicial de
  `baseUrl` en el entorno local.

La colección crea registros de prueba con nombres únicos. El producto usado
para el CRUD se elimina al completar su flujo. El producto empleado en los
movimientos y la categoría se conservan: los movimientos guardados referencian
su producto y la API no ofrece endpoints para eliminar movimientos ni
categorías. Ejecuta las pruebas preferiblemente en una base de datos de
desarrollo o pruebas.

### Ejecución en Postman

1. Inicia el backend con `npm start`.
2. En Postman, importa la colección y el archivo de entorno local indicados
   arriba.
3. Selecciona el entorno **STOCKFLOWAPI - Local** y confirma que `baseUrl`
   apunte al servidor.
4. Ejecuta la colección completa en Collection Runner, en el orden definido.
   Las solicitudes usan variables de colección para compartir los IDs
   generados durante la ejecución.

### Ejecución con Newman

Instala las dependencias del proyecto (Newman está declarado como dependencia
de desarrollo) y ejecuta:

```bash
npm install
npm start
```

En otra terminal, desde la raíz del repositorio:

```bash
npm run test:postman
```

El comando usa la colección y el entorno locales. También se puede ejecutar
Newman directamente:

```bash
npx newman run postman/collections/stockflowapi.postman_collection.json \
  --environment postman/environments/local.postman_environment.json
```

El comando `npm run test:postman` está preparado para reutilizarse en GitHub
Actions; la integración con un workflow queda para la tarea coordinada
FLOW123-40.
