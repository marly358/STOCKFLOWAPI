const Producto = require('../models/Producto');

async function registrarProducto(datosProducto) {
  const producto = new Producto(datosProducto);
  return producto.save();
}

async function listarProductos() {
  return Producto.find();
}

async function actualizarProductoPorId(id, datosProducto) {
  const camposPermitidos = ['nombre', 'precio', 'stock', 'descripcion'];
  const actualizacion = {};

  for (const campo of camposPermitidos) {
    if (Object.prototype.hasOwnProperty.call(datosProducto, campo)) {
      actualizacion[campo] = datosProducto[campo];
    }
  }

  return Producto.findByIdAndUpdate(id, actualizacion, {
    new: true,
    runValidators: true,
  });
}

module.exports = { registrarProducto, listarProductos, actualizarProductoPorId };
