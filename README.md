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
