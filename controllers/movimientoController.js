const mongoose = require('mongoose');
const {
  listarExistencias,
  listarMovimientos,
  registrarMovimiento,
} = require('../services/movimientoService');

function validarDatosMovimiento(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return ['El cuerpo de la solicitud debe ser un objeto JSON.'];
  }

  const errores = [];
  const camposPermitidos = ['productoId', 'cantidad'];
  const camposDesconocidos = Object.keys(datos).filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  if (camposDesconocidos.length > 0) {
    errores.push(`Campos no permitidos: ${camposDesconocidos.join(', ')}.`);
  }

  if (
    typeof datos.productoId !== 'string' ||
    !mongoose.isObjectIdOrHexString(datos.productoId)
  ) {
    errores.push('productoId debe ser un identificador válido.');
  }

  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    errores.push('La cantidad debe ser un número entero positivo.');
  }

  return errores;
}

async function registrar(req, res, next, tipo) {
  const errores = validarDatosMovimiento(req.body);
  if (errores.length > 0) {
    return res.status(400).json({
      message: 'Los datos del movimiento no son válidos.',
      errors: errores,
    });
  }

  try {
    const resultado = await registrarMovimiento(
      req.body.productoId,
      req.body.cantidad,
      tipo,
      req.user.id
    );

    return res.status(201).json({
      message: 'Movimiento registrado correctamente.',
      movimiento: resultado.movimiento,
      producto: resultado.producto,
    });
  } catch (error) {
    if (error.code === 'INVENTORY_PRODUCT_NOT_FOUND') {
      return res.status(404).json({ message: error.message });
    }

    if (error.code === 'INVENTORY_INSUFFICIENT_STOCK') {
      return res.status(409).json({ message: error.message });
    }
    if (error.code === 'INVENTORY_PRODUCT_INACTIVE') {
      return res.status(409).json({ message: error.message });
    }
    if (error.code === 'INVENTORY_INVALID_INPUT') {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

function registrarEntrada(req, res, next) {
  return registrar(req, res, next, 'ENTRADA');
}

function registrarSalida(req, res, next) {
  return registrar(req, res, next, 'SALIDA');
}

async function consultarExistencias(req, res, next) {
  try {
    const existencias = await listarExistencias();
    return res.status(200).json(existencias);
  } catch (error) {
    return next(error);
  }
}

async function consultarMovimientos(req, res, next) {
  try {
    const movimientos = await listarMovimientos();
    return res.status(200).json(movimientos);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registrarEntrada,
  registrarSalida,
  consultarExistencias,
  consultarMovimientos,
};
