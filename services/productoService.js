const Producto = require('../models/Producto');

async function registrarProducto(datosProducto) {
  const producto = new Producto(datosProducto);
  return producto.save();
}

async function listarProductos() {
  return Producto.find();
}

module.exports = { registrarProducto, listarProductos };
