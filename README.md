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

Actualmente el proyecto no define movimientos de inventario ni referencias
entre movimientos y productos. Por eso, esta operación elimina únicamente el
producto y no realiza borrados en cascada.
