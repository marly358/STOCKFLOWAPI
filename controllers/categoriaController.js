const mongoose = require('mongoose');
const {
  crearCategoria,
  listarCategorias,
  actualizarCategoriaPorId,
  eliminarCategoriaPorId,
} = require('../services/categoriaService');

function validarDatosCategoria(datos, parcial = false) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return ['El cuerpo de la solicitud debe ser un objeto JSON.'];
  }

  const errores = [];
  const camposPermitidos = ['nombre', 'descripcion'];
  const camposDesconocidos = Object.keys(datos).filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  if (camposDesconocidos.length > 0) {
    errores.push(`Campos no permitidos: ${camposDesconocidos.join(', ')}.`);
  }

  if ((!parcial || datos.nombre !== undefined) &&
      (typeof datos.nombre !== 'string' || datos.nombre.trim().length === 0)) {
    errores.push('El nombre es obligatorio y debe ser un texto no vacío.');
  }

  if (datos.descripcion !== undefined && typeof datos.descripcion !== 'string') {
    errores.push('La descripción debe ser un texto.');
  }

  return errores;
}

async function crear(req, res, next) {
  const errores = validarDatosCategoria(req.body);
  if (errores.length > 0) {
    return res.status(400).json({
      message: 'Los datos de la categoría no son válidos.',
      errors: errores,
    });
  }

  try {
    const categoria = await crearCategoria(req.body);
    return res.status(201).json({
      message: 'Categoría creada correctamente.',
      categoria,
    });
  } catch (error) {
    if (error.code === 'CATEGORY_DUPLICATE' || error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe una categoría con ese nombre.' });
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: 'Los datos de la categoría no son válidos.',
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

async function consultar(req, res, next) {
  try {
    const categorias = await listarCategorias();
    return res.status(200).json(categorias);
  } catch (error) {
    return next(error);
  }
}

async function actualizar(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador de la categoría no es válido.' });
  }

  const errores = validarDatosCategoria(req.body, true);
  if (Object.keys(req.body || {}).length === 0) {
    errores.push('Debe enviar al menos un campo para actualizar.');
  }
  if (errores.length > 0) {
    return res.status(400).json({ message: 'Los datos de la categoría no son válidos.', errors: errores });
  }

  try {
    const categoria = await actualizarCategoriaPorId(req.params.id, req.body);
    if (!categoria) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    return res.status(200).json({ message: 'Categoría actualizada correctamente.', categoria });
  } catch (error) {
    if (error.code === 'CATEGORY_DUPLICATE' || error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe una categoría con ese nombre.' });
    }
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Los datos de la categoría no son válidos.' });
    }
    return next(error);
  }
}

async function eliminar(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador de la categoría no es válido.' });
  }
  try {
    const categoria = await eliminarCategoriaPorId(req.params.id);
    if (!categoria) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    return res.status(200).json({ message: 'Categoría eliminada correctamente.', categoria });
  } catch (error) {
    return next(error);
  }
}

module.exports = { crear, consultar, actualizar, eliminar };