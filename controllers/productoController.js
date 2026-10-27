const mongoose = require('mongoose');
const {
  registrarProducto,
  listarProductos,
  obtenerProductoPorId,
  actualizarProductoPorId,
  eliminarProductoPorId,
} = require('../services/productoService');

async function consultarProductos(req, res, next) {
  try {
    const productos = await listarProductos(req.user.role === 'admin');
    return res.status(200).json(productos);
  } catch (error) {
    return next(error);
  }
}

async function consultarProductoPorId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador del producto no es válido.' });
  }

  try {
    const producto = await obtenerProductoPorId(req.params.id, req.user.role === 'admin');
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    return res.status(200).json(producto);
  } catch (error) {
    return next(error);
  }
}

function validarDatosProducto(datos, camposObligatorios = []) {
  const errores = [];

  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return ['El cuerpo de la solicitud debe ser un objeto JSON.'];
  }

  const camposPermitidos = ['nombre', 'precio', 'descripcion'];
  const camposDesconocidos = Object.keys(datos).filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  if (camposDesconocidos.length > 0) {
    errores.push(`Campos no permitidos: ${camposDesconocidos.join(', ')}.`);
  }

  if (
    (camposObligatorios.includes('nombre') || datos.nombre !== undefined) &&
    (typeof datos.nombre !== 'string' || datos.nombre.trim().length === 0)
  ) {
    errores.push('El nombre es obligatorio y debe ser un texto no vacío.');
  }

  if (
    (camposObligatorios.includes('precio') || datos.precio !== undefined) &&
    (typeof datos.precio !== 'number' || !Number.isFinite(datos.precio) || datos.precio < 0)
  ) {
    errores.push('El precio es obligatorio y debe ser un número finito mayor o igual a 0.');
  }

  if (Object.prototype.hasOwnProperty.call(datos, 'stock')) {
    errores.push('El stock solo puede modificarse mediante movimientos de inventario.');
  }

  if (datos.descripcion !== undefined && typeof datos.descripcion !== 'string') {
    errores.push('La descripción debe ser un texto.');
  }

  return errores;
}

async function crearProducto(req, res, next) {
  const errores = validarDatosProducto(req.body, ['nombre', 'precio']);

  if (errores.length > 0) {
    return res.status(400).json({
      message: 'Los datos del producto no son válidos.',
      errors: errores,
    });
  }

  try {
    const producto = await registrarProducto(req.body);
    return res.status(201).json({
      message: 'Producto registrado correctamente.',
      producto,
    });
  } catch (error) {
    if (error.code === 'PRODUCT_STOCK_IMMUTABLE') {
      return res.status(400).json({
        message: 'Los datos del producto no son válidos.',
        errors: [error.message],
      });
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: 'Los datos del producto no son válidos.',
        errors: Object.values(error.errors).map(({ path, message }) => ({
          field: path,
          message,
        })),
      });
    }

    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        message: `El valor del campo "${error.path}" no tiene un formato válido.`,
      });
    }

    return next(error);
  }
}

async function actualizarProducto(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      message: 'El identificador del producto no es válido.',
    });
  }

  const errores = validarDatosProducto(req.body);
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length === 0) {
    errores.push('Debe enviar al menos un campo para actualizar.');
  }

  if (errores.length > 0) {
    return res.status(400).json({
      message: 'Los datos del producto no son válidos.',
      errors: errores,
    });
  }

  try {
    const producto = await actualizarProductoPorId(req.params.id, req.body);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    return res.status(200).json({
      message: 'Producto actualizado correctamente.',
      producto,
    });
  } catch (error) {
    if (error.code === 'PRODUCT_STOCK_IMMUTABLE') {
      return res.status(400).json({
        message: 'Los datos del producto no son válidos.',
        errors: [error.message],
      });
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: 'Los datos del producto no son válidos.',
        errors: Object.values(error.errors).map(({ path, message }) => ({
          field: path,
          message,
        })),
      });
    }

    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        message: `El valor del campo "${error.path}" no tiene un formato válido.`,
      });
    }

    return next(error);
  }
}

async function eliminarProducto(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      message: 'El identificador del producto no es válido.',
    });
  }

  try {
    const producto = await eliminarProductoPorId(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    return res.status(200).json({
      message: 'Producto eliminado correctamente.',
      producto,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  crearProducto,
  consultarProductos,
  consultarProductoPorId,
  actualizarProducto,
  eliminarProducto,
};
