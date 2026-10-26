const Producto = require('../models/Producto');

async function registrarProducto(datosProducto) {
  const producto = new Producto(datosProducto);
  return producto.save();
}

module.exports = { registrarProducto };
