const Categoria = require('../models/Categoria');

function crearErrorDuplicado() {
  const error = new Error('Ya existe una categoría con ese nombre.');
  error.code = 'CATEGORY_DUPLICATE';
  return error;
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

module.exports = { crearCategoria, listarCategorias };