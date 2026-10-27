const mongoose = require('mongoose');
const Movimiento = require('../models/Movimiento');
const Producto = require('../models/Producto');

function crearErrorInventario(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function registrarMovimiento(productoId, cantidad, tipo, responsableId) {
  if (!mongoose.isObjectIdOrHexString(productoId) ||
      !mongoose.isObjectIdOrHexString(responsableId) ||
      !Number.isInteger(cantidad) ||
      cantidad <= 0 ||
      !['ENTRADA', 'SALIDA'].includes(tipo)) {
    throw crearErrorInventario(
      'INVENTORY_INVALID_INPUT',
      'Los datos del movimiento no son válidos.'
    );
  }

  const session = await mongoose.startSession();
  let movimiento;
  let productoActualizado;

  try {
    await session.withTransaction(async () => {
      const productoActivo = await Producto.exists({
        _id: productoId,
        activo: { $ne: false },
      }).session(session);
      if (!productoActivo) {
        const productoExiste = await Producto.exists({ _id: productoId }).session(session);
        if (productoExiste) {
          throw crearErrorInventario(
            'INVENTORY_PRODUCT_INACTIVE',
            'El producto está desactivado y no admite movimientos.'
          );
        }

        throw crearErrorInventario(
          'INVENTORY_PRODUCT_NOT_FOUND',
          'Producto no encontrado.'
        );
      }

      const filtro = { _id: productoId, activo: { $ne: false } };
      if (tipo === 'SALIDA') {
        filtro.stock = { $gte: cantidad };
      }

      productoActualizado = await Producto.findOneAndUpdate(
        filtro,
        { $inc: { stock: tipo === 'ENTRADA' ? cantidad : -cantidad } },
        { returnDocument: 'after', session }
      );

      if (!productoActualizado) {
        throw crearErrorInventario(
          'INVENTORY_INSUFFICIENT_STOCK',
          'No hay existencias suficientes para realizar la salida.'
        );
      }

      [movimiento] = await Movimiento.create(
        [{ producto: productoId, tipo, cantidad, responsable: responsableId }],
        { session }
      );
    });

    return { movimiento, producto: productoActualizado };
  } finally {
    await session.endSession();
  }
}

async function listarExistencias() {
  return Producto.find({ activo: { $ne: false } }, 'nombre stock').lean();
}

async function listarMovimientos() {
  return Movimiento.find()
    .populate('producto', 'nombre')
    .populate('responsable', 'nombre email role')
    .sort({ fecha: -1 })
    .lean();
}

module.exports = { registrarMovimiento, listarExistencias, listarMovimientos };
