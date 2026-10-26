const mongoose = require('mongoose');
const Movimiento = require('../models/Movimiento');
const Producto = require('../models/Producto');

function crearErrorInventario(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function registrarMovimiento(productoId, cantidad, tipo) {
  const session = await mongoose.startSession();
  let movimiento;
  let productoActualizado;

  try {
    await session.withTransaction(async () => {
      const productoExiste = await Producto.exists({ _id: productoId }).session(session);
      if (!productoExiste) {
        throw crearErrorInventario(
          'INVENTORY_PRODUCT_NOT_FOUND',
          'Producto no encontrado.'
        );
      }

      const filtro = { _id: productoId };
      if (tipo === 'SALIDA') {
        filtro.stock = { $gte: cantidad };
      }

      productoActualizado = await Producto.findOneAndUpdate(
        filtro,
        { $inc: { stock: tipo === 'ENTRADA' ? cantidad : -cantidad } },
        { new: true, session }
      );

      if (!productoActualizado) {
        throw crearErrorInventario(
          'INVENTORY_INSUFFICIENT_STOCK',
          'No hay existencias suficientes para realizar la salida.'
        );
      }

      [movimiento] = await Movimiento.create(
        [{ producto: productoId, tipo, cantidad }],
        { session }
      );
    });

    return { movimiento, producto: productoActualizado };
  } finally {
    await session.endSession();
  }
}

async function listarExistencias() {
  return Producto.find({}, 'nombre stock').lean();
}

module.exports = { registrarMovimiento, listarExistencias };
