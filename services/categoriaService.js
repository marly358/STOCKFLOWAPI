const Categoria = require('../models/Categoria');

function crearErrorDuplicado() {
  const error = new Error('Ya existe una categoría con ese nombre.');
  error.code = 'CATEGORY_DUPLICATE';
  return error;
}

function normalizarNombre(nombre) {
  return nombre.normalize('NFKC').trim().toLocaleLowerCase('es');
}

async function crearCategoria(datosCategoria) {
  const categoria = new Categoria(datosCategoria);
  await categoria.validate();

  const existente = await Categoria.exists({
    nombreNormalizado: categoria.nombreNormalizado,
  });
  if (existente) {
    throw crearErrorDuplicado();
  }

  try {
    return await categoria.save();
  } catch (error) {
    if (error.code === 11000) {
      throw crearErrorDuplicado();
    }
    throw error;
  }
}

async function listarCategorias() {
  return Categoria.find().sort({ nombre: 1 });
}

async function actualizarCategoriaPorId(id, datosCategoria) {
  const actualizacion = {};
  if (Object.prototype.hasOwnProperty.call(datosCategoria, 'nombre')) {
    actualizacion.nombre = datosCategoria.nombre;
    actualizacion.nombreNormalizado = normalizarNombre(datosCategoria.nombre);
    const existente = await Categoria.exists({
      nombreNormalizado: actualizacion.nombreNormalizado,
      _id: { $ne: id },
    });
    if (existente) {
      throw crearErrorDuplicado();
    }
  }
  if (Object.prototype.hasOwnProperty.call(datosCategoria, 'descripcion')) {
    actualizacion.descripcion = datosCategoria.descripcion;
  }

  try {
    return await Categoria.findByIdAndUpdate(id, actualizacion, {
      returnDocument: 'after',
      runValidators: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw crearErrorDuplicado();
    }
    throw error;
  }
}

async function eliminarCategoriaPorId(id) {
  return Categoria.findByIdAndDelete(id);
}

module.exports = {
  crearCategoria,
  listarCategorias,
  actualizarCategoriaPorId,
  eliminarCategoriaPorId,
};