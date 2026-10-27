const Producto = require('../models/Producto');
const Movimiento = require('../models/Movimiento');
const mongoose = require('mongoose');

function assertStockNotProvided(data) {
  if (Object.prototype.hasOwnProperty.call(data || {}, 'stock')) {
    const error = new Error('El stock solo puede modificarse mediante movimientos de inventario.');
    error.code = 'PRODUCT_STOCK_IMMUTABLE';
    throw error;
  }
}

async function registrarProducto(datosProducto) {
  assertStockNotProvided(datosProducto);
  const producto = new Producto({
    nombre: datosProducto.nombre,
    precio: datosProducto.precio,
    descripcion: datosProducto.descripcion,
    stock: 0,
  });
  return producto.save();
}

async function listarProductos(incluirInactivos = false) {
  return Producto.find(incluirInactivos ? {} : { activo: { $ne: false } });
}

async function obtenerProductoPorId(id, incluirInactivos = false) {
  const filtro = incluirInactivos ? { _id: id } : { _id: id, activo: { $ne: false } };
  return Producto.findOne(filtro);
}

async function actualizarProductoPorId(id, datosProducto) {
  assertStockNotProvided(datosProducto);
  const camposPermitidos = ['nombre', 'precio', 'descripcion'];
  const actualizacion = {};

  for (const campo of camposPermitidos) {
    if (Object.prototype.hasOwnProperty.call(datosProducto, campo)) {
      actualizacion[campo] = datosProducto[campo];
    }
  }

  return Producto.findByIdAndUpdate(id, actualizacion, {
    returnDocument: 'after',
    runValidators: true,
  });
}

async function eliminarProductoPorId(id) {
  const session = await mongoose.startSession();
  let producto;

  try {
    await session.withTransaction(async () => {
      const tieneMovimientos = await Movimiento.exists({ producto: id }).session(session);
      if (tieneMovimientos) {
        producto = await Producto.findByIdAndUpdate(
          id,
          { activo: false },
          { returnDocument: 'after', session, runValidators: true }
        );
      } else {
        producto = await Producto.findByIdAndDelete(id, { session });
      }
    });

    return producto;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  registrarProducto,
  listarProductos,
  obtenerProductoPorId,
  actualizarProductoPorId,
  eliminarProductoPorId,
};
